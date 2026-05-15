import { NextRequest, NextResponse } from "next/server";
import { searchDateAI } from "@/lib/services/search-service";
import { fetchMultipleURLs } from "@/lib/services/fetch-service";
import {
  deduplicateResults,
  processWithAI,
  filterNews,
  generateWeeklyOverview,
  generateWeeklyTrends,
  extractHotTopics,
} from "@/lib/services/processor";
import {
  upsertNewsItems,
  createWeeklyReport,
  createGenerationLog,
  updateGenerationLog,
  getWeeklyReportByDateRange,
} from "@/lib/services/db-service";

/**
 * POST /api/weekly/generate
 * 触发周报生成
 *
 * 可选 body 参数：
 * - weekStart: 周一日期 (YYYY-MM-DD)，默认上周一
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { weekStart, weekEnd, weekNumber } = getLastWeekRange(body.weekStart);

  const logId = await createGenerationLog("weekly", weekStart);

  try {
    // 检查是否已存在该周的周报
    const existing = await getWeeklyReportByDateRange(weekStart, weekEnd);
    if (existing) {
      await updateGenerationLog(logId, { status: "skipped", errorMessage: "Report already exists" });
      return NextResponse.json({
        success: true,
        reportId: existing.id,
        date: weekStart,
        message: "该周的周报已存在",
      });
    }

    // Step 1: 搜索本周AI新闻（覆盖7天）
    console.log(`[Weekly] Step 1: Searching AI news for ${weekStart} ~ ${weekEnd}`);
    // 搜索周内每天的AI新闻，然后合并去重
    const allSearchResults: Awaited<ReturnType<typeof searchDateAI>> = [];
    const dayMs = 86400000;
    const startMs = new Date(weekStart).getTime();
    for (let i = 0; i < 7; i++) {
      const dayStr = new Date(startMs + i * dayMs).toISOString().split('T')[0];
      try {
        const dayResults = await searchDateAI(dayStr);
        allSearchResults.push(...dayResults);
      } catch {
        // 跳过搜索失败的日期
      }
    }
    const searchResults = allSearchResults;
    const discoveredCount = searchResults.length;

    // Step 2: 去重
    console.log(`[Weekly] Step 2: Deduplicating`);
    const dedupedResults = deduplicateResults(searchResults);
    const afterDedupCount = dedupedResults.length;

    // Step 3: 获取详情
    console.log(`[Weekly] Step 3: Fetching details`);
    const topUrls = dedupedResults.slice(0, 15).map((r) => r.url).filter(Boolean);
    const fetchResults = await fetchMultipleURLs(topUrls, { concurrency: 3, maxLength: 3000 });
    const fetchedMap = new Map(fetchResults.filter((r) => r.success).map((r) => [r.url, r]));

    // Step 4: AI处理
    console.log(`[Weekly] Step 4: Processing with AI`);
    const processed = await processWithAI(dedupedResults, fetchedMap);

    // Step 5: 过滤
    const filtered = filterNews(processed);
    const afterFilterCount = filtered.length;
    console.log(`[Weekly] Step 5: After filter: ${afterFilterCount} items`);

    // Step 6: 入库
    console.log(`[Weekly] Step 6: Saving to database`);
    const urlToId = await upsertNewsItems(filtered);

    // Step 7: 生成周报概览和趋势
    console.log(`[Weekly] Step 7: Generating weekly overview and trends`);
    const [overview, trends] = await Promise.all([
      generateWeeklyOverview(filtered),
      generateWeeklyTrends(filtered),
    ]);
    const hotTopics = extractHotTopics(filtered);

    // Step 8: 创建周报记录
    const newsIds = filtered
      .map((n) => urlToId.get(n.sourceUrl))
      .filter((id): id is string => !!id);

    const reportId = await createWeeklyReport(
      weekStart,
      weekEnd,
      weekNumber,
      overview,
      trends.techTrends,
      trends.industryTrends,
      trends.investmentHighlights,
      hotTopics,
      newsIds
    );

    await updateGenerationLog(logId, {
      status: "success",
      discoveredCount,
      afterDedupCount,
      afterFilterCount,
    });

    console.log(`[Weekly] Done! Report ${reportId} with ${afterFilterCount} news items`);

    return NextResponse.json({
      success: true,
      reportId,
      weekStart,
      weekEnd,
      weekNumber,
      stats: {
        discovered: discoveredCount,
        afterDedup: afterDedupCount,
        afterFilter: afterFilterCount,
      },
    });
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "Unknown error";
    console.error(`[Weekly] Generation failed:`, errorMessage);

    await updateGenerationLog(logId, {
      status: "failed",
      errorMessage,
    });

    return NextResponse.json(
      { error: "周报生成失败", detail: errorMessage },
      { status: 500 }
    );
  }
}

function getLastWeekRange(customStart?: string): {
  weekStart: string;
  weekEnd: string;
  weekNumber: number;
} {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  // 上周一
  const lastMonday = new Date(now);
  lastMonday.setDate(now.getDate() + mondayOffset - 7);
  const weekStart = customStart || lastMonday.toISOString().split("T")[0];

  // 上周日
  const lastSunday = new Date(lastMonday);
  lastSunday.setDate(lastMonday.getDate() + 6);
  const weekEnd = lastSunday.toISOString().split("T")[0];

  // 周数
  const weekNumber = getISOWeek(lastMonday);

  return { weekStart, weekEnd, weekNumber };
}

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
