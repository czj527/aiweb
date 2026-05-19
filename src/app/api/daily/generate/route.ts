import { NextRequest, NextResponse } from "next/server";
import { fetchJuyaFeed } from "@/lib/services/rss-fetch-service";
import {
  deduplicateResults,
  dedupAgainstDatabase,
  convertJuyaResults,
  filterNews,
  generateDailyArticle,
  extractHotTopics,
} from "@/lib/services/processor";
import {
  upsertNewsItems,
  createDailyReport,
  createGenerationLog,
  updateGenerationLog,
  getDailyReportByDate,
  getRecentNews,
} from "@/lib/services/db-service";

/**
 * POST /api/daily/generate
 * 基于橘鸦RSS生成日报
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
    if (!force) {
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
    }

    // Step 1: 获取橘鸦RSS
    console.log(`[Daily] Step 1: Fetching 橘鸦 RSS`);
    const juyaResults = await fetchJuyaFeed();
    console.log(`[Daily] 橘鸦 collected: ${juyaResults.length} articles`);

    if (juyaResults.length === 0) {
      // 如果RSS没有新内容，尝试使用数据库中已有的新闻
      console.log("[Daily] No new RSS content, using existing news from database");
    }

    let filtered: Awaited<ReturnType<typeof convertJuyaResults>> = [];

    if (juyaResults.length > 0) {
      // Step 2: 去重
      console.log(`[Daily] Step 2: Deduplicating`);
      const dedupedResults = deduplicateResults(juyaResults);

      // Step 3: 72小时数据库去重
      const freshResults = await dedupAgainstDatabase(dedupedResults, 72);

      // Step 4: 直接转换（橘鸦内容已审核，跳过AI处理）
      console.log(`[Daily] Step 4: Converting 橘鸦 results`);
      const juyaProcessed = convertJuyaResults(freshResults);

      // Step 5: 过滤
      filtered = filterNews(juyaProcessed);
      console.log(`[Daily] After filter: ${filtered.length} items`);

      // Step 6: 入库
      console.log(`[Daily] Step 6: Saving to database`);
      await upsertNewsItems(filtered);
    }

    // Step 7: 获取今日所有新闻用于生成日报
    console.log(`[Daily] Step 7: Generating daily article`);
    const recentNews = await getRecentNews(24, 50);
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

    // 生成日报文章
    const overview = await generateDailyArticle(allNews);
    const hotTopics = extractHotTopics(allNews);

    // Step 8: 创建日报记录
    const newsIds = allNews
      .map(n => n.sourceUrl)
      .filter((url): url is string => !!url);

    const reportId = await createDailyReport(targetDate, overview, hotTopics, newsIds);

    // 更新生成日志
    await updateGenerationLog(logId, {
      status: "success",
      discoveredCount: juyaResults.length,
      afterDedupCount: juyaResults.length,
      afterFilterCount: filtered.length,
    });

    console.log(`[Daily] Done! Report ${reportId} with ${allNews.length} news items`);

    return NextResponse.json({
      success: true,
      reportId,
      date: targetDate,
      newsCount: allNews.length,
      stats: {
        discovered: juyaResults.length,
        afterFilter: filtered.length,
        totalNews: allNews.length,
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
