import { NextRequest, NextResponse } from "next/server";
import {
  generateWeeklyOverview,
  generateWeeklyTrends,
  extractHotTopics,
} from "@/lib/services/processor";
import {
  createWeeklyReport,
  createGenerationLog,
  updateGenerationLog,
  getWeeklyReportByDateRange,
  getRecentNews,
} from "@/lib/services/db-service";

/**
 * POST /api/weekly/generate
 * 基于数据库中已有的新闻生成周报
 *
 * 可选 body 参数：
 * - weekStart: 周一日期 (YYYY-MM-DD)，默认上周一
 * - force: 强制重新生成（即使已存在）
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { weekStart, weekEnd, weekNumber } = getLastWeekRange(body.weekStart);
  const force = body.force === true;

  const logId = await createGenerationLog("weekly", weekStart);

  try {
    // 检查是否已存在该周的周报
    if (!force) {
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
    }

    // Step 1: 从数据库获取最近7天的新闻
    console.log(`[Weekly] Step 1: Getting news from database for ${weekStart} ~ ${weekEnd}`);
    const recentNews = await getRecentNews(168, 200); // 7天 = 168小时
    console.log(`[Weekly] Found ${recentNews.length} news items in database`);

    if (recentNews.length === 0) {
      await updateGenerationLog(logId, { status: "empty", errorMessage: "No news found in database" });
      return NextResponse.json({
        success: false,
        error: "数据库中没有找到新闻数据，请先采集RSS",
      }, { status: 404 });
    }

    // 转换为ProcessedNews格式
    const allNews = recentNews.map(n => ({
      title: n.title,
      summary: n.summary || "",
      quote: "",
      sourceName: n.source_name || "橘鸦AI早报",
      sourceUrl: n.source_url || "",
      category: (n.category || "industry") as "model" | "agent" | "opensource" | "product" | "research" | "industry" | "policy" | "rumor",
      importanceScore: n.importance_score || 15,
      importanceLevel: n.importance_level || "S",
      keywords: (n.keywords as string[]) || [],
      isAIRelated: n.is_ai_related !== false,
      publishedAt: n.published_at || new Date().toISOString(),
      isBreaking: false,
    }));

    // 按分数排序
    allNews.sort((a, b) => b.importanceScore - a.importanceScore);

    // Step 2: 生成周报概览和趋势
    console.log(`[Weekly] Step 2: Generating weekly overview and trends`);
    const [overview, trends] = await Promise.all([
      generateWeeklyOverview(allNews),
      generateWeeklyTrends(allNews),
    ]);
    const hotTopics = extractHotTopics(allNews);

    // Step 3: 创建周报记录
    const newsIds = allNews
      .map(n => n.sourceUrl)
      .filter((url): url is string => !!url);

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
      discoveredCount: recentNews.length,
      afterDedupCount: recentNews.length,
      afterFilterCount: allNews.length,
    });

    console.log(`[Weekly] Done! Report ${reportId} with ${allNews.length} news items`);

    return NextResponse.json({
      success: true,
      reportId,
      weekStart,
      weekEnd,
      weekNumber,
      newsCount: allNews.length,
      stats: {
        discovered: recentNews.length,
        totalNews: allNews.length,
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
