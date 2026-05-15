import { NextRequest, NextResponse } from "next/server";
import { searchDateAI } from "@/lib/services/search-service";
import { fetchMultipleURLs } from "@/lib/services/fetch-service";
import {
  deduplicateResults,
  processWithAI,
  filterNews,
  generateDailyOverview,
  extractHotTopics,
} from "@/lib/services/processor";
import {
  upsertNewsItems,
  createDailyReport,
  createGenerationLog,
  updateGenerationLog,
  getDailyReportByDate,
  publishAllPendingNews,
} from "@/lib/services/db-service";

/**
 * POST /api/daily/generate
 * 触发日报生成：搜索 → 去重 → AI处理 → 入库
 *
 * 可选 body 参数：
 * - date: 指定日期 (YYYY-MM-DD)，默认昨天
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const targetDate = body.date || getYesterday();

  // 验证日期格式
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    return NextResponse.json(
      { error: "日期格式错误，请使用 YYYY-MM-DD" },
      { status: 400 }
    );
  }

  const logId = await createGenerationLog("daily", targetDate);

  try {
    // 检查是否已存在该日期的日报
    const existing = await getDailyReportByDate(targetDate);
    if (existing) {
      await updateGenerationLog(logId, { status: "skipped", errorMessage: "Report already exists" });
      return NextResponse.json({
        success: true,
        reportId: existing.id,
        date: targetDate,
        message: "该日期的日报已存在",
      });
    }

    // Step 0: 自动发布所有pending新闻（到时间自动发布，不管是否人工审核）
    console.log(`[Daily] Step 0: Auto-publishing pending news`);
    await publishAllPendingNews();

    // Step 1: 搜索AI相关新闻
    console.log(`[Daily] Step 1: Searching AI news for ${targetDate}`);
    const searchResults = await searchDateAI(targetDate);
    const discoveredCount = searchResults.length;

    // Step 2: 三层去重
    console.log(`[Daily] Step 2: Deduplicating ${discoveredCount} results`);
    const dedupedResults = deduplicateResults(searchResults);
    const afterDedupCount = dedupedResults.length;

    // Step 3: 获取Top条目的详细内容（用于更精准的摘要）
    console.log(`[Daily] Step 3: Fetching details for top ${Math.min(dedupedResults.length, 10)} items`);
    const topUrls = dedupedResults.slice(0, 30).map((r) => r.url).filter(Boolean);
    const fetchResults = await fetchMultipleURLs(topUrls, { concurrency: 5, maxLength: 5000 });
    const fetchedMap = new Map(fetchResults.filter((r) => r.success).map((r) => [r.url, r]));

    // Step 4: AI处理（分类 + 打分 + 摘要）
    console.log(`[Daily] Step 4: Processing with AI`);
    const processed = await processWithAI(dedupedResults, fetchedMap);

    // Step 5: 过滤非AI和低质量内容
    const filtered = filterNews(processed);
    const afterFilterCount = filtered.length;
    console.log(`[Daily] Step 5: After filter: ${afterFilterCount} items`);

    // Step 6: 入库
    console.log(`[Daily] Step 6: Saving to database`);
    const urlToId = await upsertNewsItems(filtered);

    // Step 7: 生成日报概览
    console.log(`[Daily] Step 7: Generating daily overview`);
    const overview = await generateDailyOverview(filtered);
    const hotTopics = extractHotTopics(filtered);

    // Step 8: 创建日报记录
    const newsIds = filtered
      .map((n) => urlToId.get(n.sourceUrl))
      .filter((id): id is string => !!id);

    const reportId = await createDailyReport(targetDate, overview, hotTopics, newsIds);

    // 更新生成日志
    await updateGenerationLog(logId, {
      status: "success",
      discoveredCount,
      afterDedupCount,
      afterFilterCount,
    });

    console.log(`[Daily] Done! Report ${reportId} with ${afterFilterCount} news items`);

    return NextResponse.json({
      success: true,
      reportId,
      date: targetDate,
      stats: {
        discovered: discoveredCount,
        afterDedup: afterDedupCount,
        afterFilter: afterFilterCount,
      },
    });
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "Unknown error";
    console.error(`[Daily] Generation failed:`, errorMessage);

    await updateGenerationLog(logId, {
      status: "failed",
      errorMessage,
    });

    return NextResponse.json(
      { error: "日报生成失败", detail: errorMessage },
      { status: 500 }
    );
  }
}

function getYesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}
