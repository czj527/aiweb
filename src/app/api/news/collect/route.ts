import { NextRequest, NextResponse } from "next/server";
import { searchDateAI } from "@/lib/services/search-service";
import { fetchAllRSSFeeds, fetchJuyaFeed } from "@/lib/services/rss-fetch-service";
import { fetchMultipleURLs } from "@/lib/services/fetch-service";
import {
  deduplicateResults,
  dedupAgainstDatabase,
  processWithAI,
  convertJuyaResults,
  filterNews,
} from "@/lib/services/processor";
import { upsertNewsItems, createGenerationLog, updateGenerationLog } from "@/lib/services/db-service";

function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * POST /api/news/collect
 * 三层采集架构：橘鸦（主料，已审核）→ RSS（补充）→ SearXNG（兜底）
 *
 * 可选 body 参数：
 * - date: 指定日期 (YYYY-MM-DD)，默认今天
 * - hours: 往前推多少小时，默认 24
 * - skipSearch: 是否跳过SearXNG搜索，默认 false
 * - skipJuya: 是否跳过橘鸦RSS，默认 false
 * - skipRSS: 是否跳过我们的RSS源，默认 false
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const targetDate = body.date || getToday();
  const hours = Number(body.hours) || 24;
  const skipSearch = body.skipSearch === true;
  const skipJuya = body.skipJuya === true;
  const skipRSS = body.skipRSS === true;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    return NextResponse.json(
      { error: "日期格式错误，请使用 YYYY-MM-DD" },
      { status: 400 }
    );
  }

  const logId = await createGenerationLog("collect", targetDate);

  try {
    // ============ 第一层：橘鸦AI早报（主料，已审核内容） ============
    let juyaResults: Awaited<ReturnType<typeof fetchJuyaFeed>> = [];
    if (!skipJuya) {
      console.log(`[Collect] Layer 1: 橘鸦AI早报 RSS`);
      juyaResults = await fetchJuyaFeed();
      console.log(`[Collect] 橘鸦 collected: ${juyaResults.length} articles`);
    }

    // ============ 第二层：我们的RSS源（补充，覆盖橘鸦未收录的内容） ============
    let rssResults: Awaited<ReturnType<typeof fetchAllRSSFeeds>> = [];
    if (!skipRSS) {
      console.log(`[Collect] Layer 2: Our RSS feeds (past ${hours}h)`);
      rssResults = await fetchAllRSSFeeds(hours, 10);
      console.log(`[Collect] RSS collected: ${rssResults.length} items`);
    }

    // ============ 第三层：SearXNG搜索（兜底） ============
    let searchResults: typeof rssResults = [];
    if (!skipSearch) {
      console.log(`[Collect] Layer 3: SearXNG search`);
      searchResults = await searchDateAI(targetDate);
      console.log(`[Collect] SearXNG collected: ${searchResults.length} items`);
    }

    // ============ 合并 + 去重（橘鸦优先，URL相同则保留橘鸦版本） ============
    // 橘鸦放前面，deduplicateResults 保留先出现的，所以橘鸦 URL 优先
    const allResults = [...juyaResults, ...rssResults, ...searchResults];
    const discoveredCount = allResults.length;
    console.log(`[Collect] Total before dedup: ${discoveredCount}`);

    const dedupedResults = deduplicateResults(allResults);
    console.log(`[Collect] After dedup: ${dedupedResults.length}`);

    // ============ 72小时数据库去重 ============
    const freshResults = await dedupAgainstDatabase(dedupedResults, 72);
    console.log(`[Collect] After 72h DB dedup: ${freshResults.length}`);

    // ============ 分流处理：橘鸦直接转换，其余走AI ============
    const juyaItems = freshResults.filter(r => r.source === "橘鸦AI早报");
    const otherItems = freshResults.filter(r => r.source !== "橘鸦AI早报");

    console.log(`[Collect] Split: ${juyaItems.length} from 橘鸦, ${otherItems.length} from other sources`);

    // 橘鸦：直接转换为 ProcessedNews（跳过AI处理，已审核内容）
    const juyaProcessed = convertJuyaResults(juyaItems);
    console.log(`[Collect] 橘鸦 converted: ${juyaProcessed.length} items (no AI call)`);

    // 其他源：走完整AI处理流程
    let otherProcessed: Awaited<ReturnType<typeof processWithAI>> = [];
    if (otherItems.length > 0) {
      // 获取详情（Top 20条）
      console.log(`[Collect] Fetching details for top ${Math.min(otherItems.length, 20)} items`);
      const topUrls = otherItems.slice(0, 20).map(r => r.url).filter(Boolean);
      const fetchResults = await fetchMultipleURLs(topUrls, { concurrency: 5, maxLength: 5000 });
      const fetchedMap = new Map(fetchResults.filter(r => r.success).map(r => [r.url, r]));

      console.log(`[Collect] AI processing ${otherItems.length} items`);
      otherProcessed = await processWithAI(otherItems, fetchedMap);
    }

    // ============ 合并 + 最终过滤 ============
    const allProcessed = [...juyaProcessed, ...otherProcessed];
    console.log(`[Collect] Total processed: ${allProcessed.length}`);

    const filtered = filterNews(allProcessed);
    console.log(`[Collect] After filter: ${filtered.length} items`);

    // ============ 入库 ============
    console.log(`[Collect] Saving ${filtered.length} news items`);
    await upsertNewsItems(filtered);

    await updateGenerationLog(logId, {
      status: "success",
      discoveredCount,
      afterDedupCount: dedupedResults.length,
      afterFilterCount: filtered.length,
    });

    console.log(`[Collect] Done! Collected ${filtered.length} news items`);

    return NextResponse.json({
      success: true,
      date: targetDate,
      newsCount: filtered.length,
      stats: {
        juya: juyaResults.length,
        rss: rssResults.length,
        search: searchResults.length,
        discovered: discoveredCount,
        afterDedup: dedupedResults.length,
        juyaConverted: juyaProcessed.length,
        aiProcessed: otherProcessed.length,
        afterFilter: filtered.length,
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
