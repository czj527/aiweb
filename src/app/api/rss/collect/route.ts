import { NextResponse } from "next/server";
import { fetchJuyaFeed } from "@/lib/services/rss-fetch-service";
import {
  deduplicateResults,
  dedupAgainstDatabase,
  convertJuyaResults,
  filterNews,
} from "@/lib/services/processor";
import { upsertNewsItems, createGenerationLog, updateGenerationLog } from "@/lib/services/db-service";

/**
 * POST /api/rss/collect
 * 仅采集橘鸦AI早报RSS（快速、可靠）
 *
 * 可选 body 参数：
 * - stream: 是否使用SSE流式返回（默认false）
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const useStream = body.stream === true;

  if (useStream) {
    return handleStreamCollect();
  }

  return handleJsonCollect();
}

function sseData(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

function handleStreamCollect() {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        try {
          controller.enqueue(encoder.encode(sseData(data)));
        } catch {
          // Controller may already be closed
        }
      };

      const today = new Date().toISOString().slice(0, 10);
      const logId = await createGenerationLog("rss-collect", today);

      try {
        // Step 1: 获取橘鸦RSS
        send({ type: "step", message: "正在获取橘鸦AI早报RSS..." });
        console.log("[RSS-Collect] Fetching 橘鸦 RSS");
        const juyaResults = await fetchJuyaFeed();
        send({ type: "progress", count: juyaResults.length });
        console.log(`[RSS-Collect] 橘鸦 collected: ${juyaResults.length} articles`);

        if (juyaResults.length === 0) {
          send({ type: "error", message: "橘鸦RSS暂无更新" });
          await updateGenerationLog(logId, { status: "empty", errorMessage: "No new content from RSS" });
          controller.close();
          return;
        }

        // Step 2: 去重
        send({ type: "step", message: "去重中..." });
        const dedupedResults = deduplicateResults(juyaResults);
        console.log(`[RSS-Collect] After dedup: ${dedupedResults.length}`);

        // Step 3: 72小时数据库去重
        const freshResults = await dedupAgainstDatabase(dedupedResults, 72);
        console.log(`[RSS-Collect] After 72h DB dedup: ${freshResults.length}`);

        if (freshResults.length === 0) {
          send({ type: "success", message: "没有新内容需要入库", newsCount: 0 });
          await updateGenerationLog(logId, { status: "success", discoveredCount: juyaResults.length, afterDedupCount: dedupedResults.length, afterFilterCount: 0 });
          controller.close();
          return;
        }

        // Step 4: 直接转换（橘鸦内容已审核，跳过AI处理）
        send({ type: "step", message: "处理中..." });
        const juyaProcessed = convertJuyaResults(freshResults);
        console.log(`[RSS-Collect] Converted: ${juyaProcessed.length} items`);

        // Step 5: 过滤
        const filtered = filterNews(juyaProcessed);
        console.log(`[RSS-Collect] After filter: ${filtered.length} items`);

        // Step 6: 入库
        send({ type: "step", message: "入库中..." });
        await upsertNewsItems(filtered);
        console.log(`[RSS-Collect] Saved ${filtered.length} items`);

        await updateGenerationLog(logId, {
          status: "success",
          discoveredCount: juyaResults.length,
          afterDedupCount: dedupedResults.length,
          afterFilterCount: filtered.length,
        });

        send({
          type: "done",
          success: true,
          newsCount: filtered.length,
          stats: {
            discovered: juyaResults.length,
            afterDedup: dedupedResults.length,
            afterFilter: filtered.length,
          },
        });
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : "Unknown error";
        console.error("[RSS-Collect] Failed:", errorMessage);
        await updateGenerationLog(logId, { status: "failed", errorMessage });
        send({ type: "error", message: "RSS采集失败", detail: errorMessage });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

async function handleJsonCollect() {
  const today = new Date().toISOString().slice(0, 10);
  const logId = await createGenerationLog("rss-collect", today);

  try {
    console.log("[RSS-Collect] Fetching 橘鸦 RSS");
    const juyaResults = await fetchJuyaFeed();
    console.log(`[RSS-Collect] 橘鸦 collected: ${juyaResults.length} articles`);

    if (juyaResults.length === 0) {
      await updateGenerationLog(logId, { status: "empty", errorMessage: "No new content from RSS" });
      return NextResponse.json({ success: true, newsCount: 0, message: "橘鸦RSS暂无更新" });
    }

    const dedupedResults = deduplicateResults(juyaResults);
    console.log(`[RSS-Collect] After dedup: ${dedupedResults.length}`);

    const freshResults = await dedupAgainstDatabase(dedupedResults, 72);
    console.log(`[RSS-Collect] After 72h DB dedup: ${freshResults.length}`);

    if (freshResults.length === 0) {
      await updateGenerationLog(logId, { status: "success", discoveredCount: juyaResults.length, afterDedupCount: dedupedResults.length, afterFilterCount: 0 });
      return NextResponse.json({ success: true, newsCount: 0, message: "没有新内容需要入库" });
    }

    const juyaProcessed = convertJuyaResults(freshResults);
    console.log(`[RSS-Collect] Converted: ${juyaProcessed.length} items`);

    const filtered = filterNews(juyaProcessed);
    console.log(`[RSS-Collect] After filter: ${filtered.length} items`);

    await upsertNewsItems(filtered);
    console.log(`[RSS-Collect] Saved ${filtered.length} items`);

    await updateGenerationLog(logId, {
      status: "success",
      discoveredCount: juyaResults.length,
      afterDedupCount: dedupedResults.length,
      afterFilterCount: filtered.length,
    });

    return NextResponse.json({
      success: true,
      newsCount: filtered.length,
      stats: {
        discovered: juyaResults.length,
        afterDedup: dedupedResults.length,
        afterFilter: filtered.length,
      },
    });
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "Unknown error";
    console.error("[RSS-Collect] Failed:", errorMessage);
    await updateGenerationLog(logId, { status: "failed", errorMessage });
    return NextResponse.json({ error: "RSS采集失败", detail: errorMessage }, { status: 500 });
  }
}
