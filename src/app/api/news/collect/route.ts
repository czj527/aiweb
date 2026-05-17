import { NextRequest, NextResponse } from "next/server";
import { searchDateAI } from "@/lib/services/search-service";
import { fetchAllRSSFeeds } from "@/lib/services/rss-fetch-service";
import { fetchMultipleURLs } from "@/lib/services/fetch-service";
import {
  deduplicateResults,
  dedupAgainstDatabase,
  processWithAI,
  filterNews,
} from "@/lib/services/processor";
import { upsertNewsItems, createGenerationLog, updateGenerationLog } from "@/lib/services/db-service";

function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * POST /api/news/collect
 * 两层采集架构：RSS（主力）+ SearXNG（补充）
 *
 * 可选 body 参数：
 * - date: 指定日期 (YYYY-MM-DD)，默认今天
 * - hours: 往前推多少小时，默认 24
 * - skipSearch: 是否跳过SearXNG搜索（仅RSS），默认 false
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const targetDate = body.date || getToday();
  const hours = Number(body.hours) || 24;
  const skipSearch = body.skipSearch === true;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    return NextResponse.json(
      { error: "日期格式错误，请使用 YYYY-MM-DD" },
      { status: 400 }
    );
  }

  const logId = await createGenerationLog("collect", targetDate);

  try {
    // ============ 第一层：RSS采集（主力，最可靠） ============
    console.log(`[Collect] Layer 1: RSS feeds (past ${hours}h)`);
    const rssResults = await fetchAllRSSFeeds(hours, 10);
    console.log(`[Collect] RSS collected: ${rssResults.length} items`);

    // ============ 第二层：SearXNG搜索（补充，覆盖无RSS的源） ============
    let searchResults: typeof rssResults = [];
    if (!skipSearch) {
      console.log(`[Collect] Layer 2: SearXNG search (past ${hours}h)`);
      searchResults = await searchDateAI(targetDate);
      console.log(`[Collect] SearXNG collected: ${searchResults.length} items`);
    }

    // ============ 合并去重 ============
    const allResults = [...rssResults, ...searchResults];
    console.log(`[Collect] Total before dedup: ${allResults.length}`);

    const dedupedResults = deduplicateResults(allResults);
    const discoveredCount = allResults.length;
    const afterDedupCount = dedupedResults.length;
    console.log(`[Collect] After dedup: ${afterDedupCount}`);

    // ============ 72小时数据库去重（排除已有新闻） ============
    const freshResults = await dedupAgainstDatabase(dedupedResults, 72);
    console.log(`[Collect] After 72h DB dedup: ${freshResults.length}`);

    // ============ 获取详情（Top 30条） ============
    console.log(`[Collect] Fetching details for top ${Math.min(freshResults.length, 30)} items`);
    const topUrls = freshResults.slice(0, 30).map((r) => r.url).filter(Boolean);
    const fetchResults = await fetchMultipleURLs(topUrls, { concurrency: 5, maxLength: 5000 });
    const fetchedMap = new Map(fetchResults.filter((r) => r.success).map((r) => [r.url, r]));

    // ============ AI处理（分类+打分+摘要+质量审核） ============
    console.log(`[Collect] AI processing ${freshResults.length} items`);
    const processed = await processWithAI(freshResults, fetchedMap);

    // ============ 过滤（AI相关性+质量+时效+评分） ============
    const filtered = filterNews(processed);
    const afterFilterCount = filtered.length;
    console.log(`[Collect] After filter: ${afterFilterCount} items`);

    // ============ 入库 ============
    console.log(`[Collect] Saving ${afterFilterCount} news items`);
    await upsertNewsItems(filtered);

    await updateGenerationLog(logId, {
      status: "success",
      discoveredCount,
      afterDedupCount,
      afterFilterCount,
    });

    console.log(`[Collect] Done! Collected ${afterFilterCount} news items`);

    return NextResponse.json({
      success: true,
      date: targetDate,
      newsCount: afterFilterCount,
      stats: {
        rss: rssResults.length,
        search: searchResults.length,
        discovered: discoveredCount,
        afterDedup: afterDedupCount,
        afterFilter: afterFilterCount,
      },
    });
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "Unknown error";
    console.error(`[Collect] Collection failed:`, errorMessage);

    await updateGenerationLog(logId, {
      status: "failed",
      errorMessage,
    });

    return NextResponse.json(
      { error: "资讯收集失败", detail: errorMessage },
      { status: 500 }
    );
  }
}
