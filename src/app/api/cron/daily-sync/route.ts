import { NextRequest, NextResponse } from "next/server";
import { fetchJuyaFeed, fetchJuyaDailyReport, parseJuyaHTML } from "@/lib/services/rss-fetch-service";
import {
  deduplicateResults,
  dedupAgainstDatabase,
  convertJuyaResults,
  extractHotTopics,
} from "@/lib/services/processor";
import {
  upsertNewsItems,
  createDailyReport,
  getDailyReportByDate,
  createGenerationLog,
  updateGenerationLog,
} from "@/lib/services/db-service";

/**
 * POST /api/cron/daily-sync
 * 每日自动同步：采集橘鸦RSS → 生成日报
 *
 * 流程：
 * 1. 获取橘鸦RSS完整日报内容
 * 2. 获取单条新闻用于首页展示
 * 3. 去重 + 入库
 * 4. 创建日报记录（使用橘鸦原始内容）
 *
 * 可选 body 参数：
 * - date: 指定日期 (YYYY-MM-DD)，默认今天
 * - force: 强制重新生成（即使已存在）
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const today = new Date().toISOString().slice(0, 10);
  const targetDate = body.date || today;
  const force = body.force === true;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    return NextResponse.json({ error: "日期格式错误，请使用 YYYY-MM-DD" }, { status: 400 });
  }

  const logId = await createGenerationLog("daily-sync", targetDate);

  try {
    // Step 0: 检查是否已存在日报
    if (!force) {
      const existing = await getDailyReportByDate(targetDate);
      if (existing) {
        await updateGenerationLog(logId, { status: "skipped", message: "Report already exists" });
        return NextResponse.json({
          success: true,
          skipped: true,
          message: `${targetDate} 的日报已存在`,
        });
      }
    }

    // Step 1: 获取橘鸦完整日报HTML
    console.log("[Daily-Sync] Step 1: Fetching 橘鸦 daily report");
    const html = await fetchJuyaDailyReport();
    const parsed = parseJuyaHTML(html);

    console.log(`[Daily-Sync] Got report: ${parsed.title}`);

    // Step 2: 获取单条新闻用于首页展示
    console.log("[Daily-Sync] Step 2: Fetching individual news items");
    const juyaResults = await fetchJuyaFeed();
    console.log(`[Daily-Sync] Got ${juyaResults.length} news items`);

    // Step 3: 去重 + 入库（橘鸦内容已审核，跳过filterNews）
    let savedCount = 0;
    if (juyaResults.length > 0) {
      console.log("[Daily-Sync] Step 3: Deduplicating and saving");
      const dedupedResults = deduplicateResults(juyaResults);
      const freshResults = await dedupAgainstDatabase(dedupedResults, 72);
      const processedNews = convertJuyaResults(freshResults);
      await upsertNewsItems(processedNews);
      savedCount = processedNews.length;
      console.log(`[Daily-Sync] Saved ${savedCount} news items`);
    }

    // Step 4: 创建日报记录（使用橘鸦原始内容）
    console.log("[Daily-Sync] Step 4: Creating daily report");
    const reportId = await createDailyReport(
      targetDate,
      html, // 使用橘鸦的完整HTML内容
      [],
      []
    );
    console.log(`[Daily-Sync] Report created: ${reportId}`);

    await updateGenerationLog(logId, {
      status: "success",
      discoveredCount: juyaResults.length,
      afterDedupCount: savedCount,
      afterFilterCount: savedCount,
    });

    return NextResponse.json({
      success: true,
      reportId,
      newsCount: savedCount,
      date: targetDate,
      title: parsed.title,
    });
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "Unknown error";
    console.error("[Daily-Sync] Failed:", errorMessage);
    await updateGenerationLog(logId, { status: "failed", errorMessage });
    return NextResponse.json({ error: "每日同步失败", detail: errorMessage }, { status: 500 });
  }
}
