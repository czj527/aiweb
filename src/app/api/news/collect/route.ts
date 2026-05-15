import { NextRequest, NextResponse } from "next/server";
import { searchDateAI } from "@/lib/services/search-service";
import { fetchMultipleURLs } from "@/lib/services/fetch-service";
import {
  deduplicateResults,
  processWithAI,
  filterNews,
} from "@/lib/services/processor";
import { upsertNewsItems, createGenerationLog, updateGenerationLog } from "@/lib/services/db-service";

function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * POST /api/news/collect
 * 仅收集资讯（搜索→去重→AI处理→入库），不生成日报
 *
 * 可选 body 参数：
 * - date: 指定日期 (YYYY-MM-DD)，默认今天
 * - hours: 往前推多少小时，默认 24
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const targetDate = body.date || getToday();
  const hours = Number(body.hours) || 24;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    return NextResponse.json(
      { error: "日期格式错误，请使用 YYYY-MM-DD" },
      { status: 400 }
    );
  }

  const logId = await createGenerationLog("collect", targetDate);

  try {
    // Step 1: 搜索AI相关新闻
    console.log(`[Collect] Step 1: Searching AI news for ${targetDate} (past ${hours}h)`);
    const searchResults = await searchDateAI(targetDate);
    const discoveredCount = searchResults.length;

    // Step 2: 去重
    console.log(`[Collect] Step 2: Deduplicating ${discoveredCount} results`);
    const dedupedResults = deduplicateResults(searchResults);
    const afterDedupCount = dedupedResults.length;

    // Step 3: 获取Top条目的详细内容
    console.log(`[Collect] Step 3: Fetching details for top ${Math.min(dedupedResults.length, 10)} items`);
    const topUrls = dedupedResults.slice(0, 10).map((r) => r.url).filter(Boolean);
    const fetchResults = await fetchMultipleURLs(topUrls, { concurrency: 3, maxLength: 3000 });
    const fetchedMap = new Map(fetchResults.filter((r) => r.success).map((r) => [r.url, r]));

    // Step 4: AI处理（分类 + 打分 + 摘要）
    console.log(`[Collect] Step 4: Processing with AI`);
    const processed = await processWithAI(dedupedResults, fetchedMap);

    // Step 5: 过滤低质量内容
    const filtered = filterNews(processed);
    const afterFilterCount = filtered.length;
    console.log(`[Collect] Step 5: After filter: ${afterFilterCount} items`);

    // Step 6: 入库（不创建日报）
    console.log(`[Collect] Step 6: Saving ${afterFilterCount} news items`);
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
