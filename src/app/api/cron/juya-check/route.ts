import { NextRequest, NextResponse } from "next/server";
import { fetchJuyaFeed, fetchJuyaDailyReport } from "@/lib/services/rss-fetch-service";
import {
  deduplicateResults,
  dedupAgainstDatabase,
  convertJuyaResults,
} from "@/lib/services/processor";
import {
  upsertNewsItems,
  createDailyReport,
  createGenerationLog,
  updateGenerationLog,
  getDailyReportByDate,
} from "@/lib/services/db-service";

const CRON_SECRET = process.env.CRON_SECRET || "";

/**
 * POST /api/cron/juya-check
 * 检查橘鸦RSS是否有更新，有则采集入库+生成日报记录
 * 
 * 需要验证 CRON_SECRET
 */
export async function POST(request: NextRequest) {
  // 验证 cron secret
  const auth = request.headers.get("authorization")?.replace("Bearer ", "");
  if (CRON_SECRET && auth !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const logId = await createGenerationLog("juya-check", today);

  try {
    // Step 1: 检查是否已有当天日报（如果已有则跳过采集）
    const existingReport = await getDailyReportByDate(today);
    if (existingReport) {
      await updateGenerationLog(logId, { status: "skipped", errorMessage: "Report already exists" });
      return NextResponse.json({
        success: true,
        skipped: true,
        message: `${today} 的日报已存在`,
      });
    }

    // Step 2: 获取橘鸦RSS新闻列表
    console.log(`[JuyaCheck] Step 2: Fetching 橘鸦 RSS`);
    const juyaResults = await fetchJuyaFeed();
    console.log(`[JuyaCheck] Collected ${juyaResults.length} articles from 橘鸦`);

    if (juyaResults.length === 0) {
      await updateGenerationLog(logId, { status: "no_content", errorMessage: "No content from 橘鸦 RSS" });
      return NextResponse.json({
        success: true,
        message: "橘鸦RSS暂无更新",
        newsCount: 0,
      });
    }

    // Step 3: URL去重
    console.log(`[JuyaCheck] Step 3: Deduplicating`);
    const dedupedResults = deduplicateResults(juyaResults);

    // Step 4: 72小时数据库去重
    const freshResults = await dedupAgainstDatabase(dedupedResults, 72);
    console.log(`[JuyaCheck] After dedup: ${freshResults.length} articles`);

    // Step 5: 转换格式（橘鸦内容已审核，跳过AI处理和filterNews）
    const processedNews = convertJuyaResults(freshResults);

    // Step 6: 入库
    console.log(`[JuyaCheck] Step 6: Saving to database`);
    await upsertNewsItems(processedNews);

    // Step 7: 获取完整日报HTML并创建日报记录
    console.log(`[JuyaCheck] Step 7: Creating daily report`);
    const juyaReport = await fetchJuyaDailyReport();
    
    let reportId: string;
    if (juyaReport) {
      // 使用橘鸦的完整HTML内容作为日报overview
      reportId = await createDailyReport(today, juyaReport.content, [], []);
    } else {
      // 降级：用新闻条数作为概览
      reportId = await createDailyReport(today, `今日共 ${processedNews.length} 条AI资讯`, [], []);
    }
    console.log(`[JuyaCheck] Created daily report: ${reportId}`);

    // 更新生成日志
    await updateGenerationLog(logId, {
      status: "success",
      discoveredCount: juyaResults.length,
      afterDedupCount: freshResults.length,
      afterFilterCount: processedNews.length,
    });

    console.log(`[JuyaCheck] Done! ${processedNews.length} news items processed`);

    return NextResponse.json({
      success: true,
      date: today,
      newsCount: processedNews.length,
      reportId,
    });
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "Unknown error";
    console.error(`[JuyaCheck] Failed:`, errorMessage);

    await updateGenerationLog(logId, {
      status: "failed",
      errorMessage,
    });

    return NextResponse.json(
      { error: "橘鸦采集失败", detail: errorMessage },
      { status: 500 }
    );
  }
}
