import { NextRequest, NextResponse } from "next/server";
import { fetchJuyaFeed, fetchJuyaDailyReport } from "@/lib/services/rss-fetch-service";
import {
  deduplicateResults,
  dedupAgainstDatabase,
  convertJuyaResults,
  filterNews,
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
 * - stream: 是否使用SSE流式返回（默认false）
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const today = new Date().toISOString().slice(0, 10);
  const targetDate = body.date || today;
  const force = body.force === true;
  const useStream = body.stream === true;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    return NextResponse.json({ error: "日期格式错误，请使用 YYYY-MM-DD" }, { status: 400 });
  }

  if (useStream) {
    return handleStreamSync(targetDate, force);
  }

  return handleJsonSync(targetDate, force);
}

function sseData(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

function handleStreamSync(targetDate: string, force: boolean) {
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

      const logId = await createGenerationLog("daily-sync", targetDate);

      try {
        // Step 0: 检查是否已存在日报
        if (!force) {
          const existing = await getDailyReportByDate(targetDate);
          if (existing) {
            send({ type: "info", message: `${targetDate} 的日报已存在，跳过生成` });
            await updateGenerationLog(logId, { status: "skipped", errorMessage: "Report already exists" });
            send({ type: "done", success: true, skipped: true });
            controller.close();
            return;
          }
        }

        // Step 1: 获取橘鸦完整日报
        send({ type: "step", message: "正在获取橘鸦AI早报..." });
        console.log("[Daily-Sync] Step 1: Fetching 橘鸦 daily report");
        const juyaReport = await fetchJuyaDailyReport();

        if (!juyaReport) {
          send({ type: "error", message: "橘鸦RSS暂无更新" });
          await updateGenerationLog(logId, { status: "empty", errorMessage: "No new content from RSS" });
          controller.close();
          return;
        }

        send({ type: "progress", title: juyaReport.title, date: juyaReport.date });
        console.log(`[Daily-Sync] Got report: ${juyaReport.title}`);

        // Step 2: 获取单条新闻用于首页展示
        send({ type: "step", message: "正在解析新闻条目..." });
        console.log("[Daily-Sync] Step 2: Fetching individual news items");
        const juyaResults = await fetchJuyaFeed();
        console.log(`[Daily-Sync] Got ${juyaResults.length} news items`);

        // Step 3: 去重 + 入库
        if (juyaResults.length > 0) {
          send({ type: "step", message: "去重入库中..." });
          console.log("[Daily-Sync] Step 3: Deduplicating and saving");
          const dedupedResults = deduplicateResults(juyaResults);
          const freshResults = await dedupAgainstDatabase(dedupedResults, 72);
          const juyaProcessed = convertJuyaResults(freshResults);
          const filtered = filterNews(juyaProcessed);
          await upsertNewsItems(filtered);
          console.log(`[Daily-Sync] Saved ${filtered.length} news items`);
        }

        // Step 4: 提取热门话题
        const hotTopics = extractHotTopics(convertJuyaResults(juyaResults));

        // Step 5: 创建日报记录（使用橘鸦原始内容）
        send({ type: "step", message: "保存日报..." });
        console.log("[Daily-Sync] Step 5: Creating daily report");
        const reportId = await createDailyReport(
          targetDate,
          juyaReport.content, // 使用橘鸦的完整HTML内容
          hotTopics,
          [] // 不关联单独的新闻条目
        );
        console.log(`[Daily-Sync] Report created: ${reportId}`);

        await updateGenerationLog(logId, {
          status: "success",
          discoveredCount: juyaResults.length,
          afterDedupCount: juyaResults.length,
          afterFilterCount: juyaResults.length,
        });

        send({
          type: "done",
          success: true,
          reportId,
          newsCount: juyaResults.length,
          date: targetDate,
          title: juyaReport.title,
        });
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : "Unknown error";
        console.error("[Daily-Sync] Failed:", errorMessage);
        await updateGenerationLog(logId, { status: "failed", errorMessage });
        send({ type: "error", message: "每日同步失败", detail: errorMessage });
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

async function handleJsonSync(targetDate: string, force: boolean) {
  const logId = await createGenerationLog("daily-sync", targetDate);

  try {
    // Step 0: 检查是否已存在日报
    if (!force) {
      const existing = await getDailyReportByDate(targetDate);
      if (existing) {
        await updateGenerationLog(logId, { status: "skipped", errorMessage: "Report already exists" });
        return NextResponse.json({
          success: true,
          skipped: true,
          message: `${targetDate} 的日报已存在`,
        });
      }
    }

    // Step 1: 获取橘鸦完整日报
    console.log("[Daily-Sync] Step 1: Fetching 橘鸦 daily report");
    const juyaReport = await fetchJuyaDailyReport();

    if (!juyaReport) {
      await updateGenerationLog(logId, { status: "empty", errorMessage: "No new content from RSS" });
      return NextResponse.json({ success: true, newsCount: 0, message: "橘鸦RSS暂无更新" });
    }

    console.log(`[Daily-Sync] Got report: ${juyaReport.title}`);

    // Step 2: 获取单条新闻用于首页展示
    console.log("[Daily-Sync] Step 2: Fetching individual news items");
    const juyaResults = await fetchJuyaFeed();
    console.log(`[Daily-Sync] Got ${juyaResults.length} news items`);

    // Step 3: 去重 + 入库
    if (juyaResults.length > 0) {
      console.log("[Daily-Sync] Step 3: Deduplicating and saving");
      const dedupedResults = deduplicateResults(juyaResults);
      const freshResults = await dedupAgainstDatabase(dedupedResults, 72);
      const juyaProcessed = convertJuyaResults(freshResults);
      const filtered = filterNews(juyaProcessed);
      await upsertNewsItems(filtered);
      console.log(`[Daily-Sync] Saved ${filtered.length} news items`);
    }

    // Step 4: 提取热门话题
    const hotTopics = extractHotTopics(convertJuyaResults(juyaResults));

    // Step 5: 创建日报记录（使用橘鸦原始内容）
    console.log("[Daily-Sync] Step 5: Creating daily report");
    const reportId = await createDailyReport(
      targetDate,
      juyaReport.content, // 使用橘鸦的完整HTML内容
      hotTopics,
      [] // 不关联单独的新闻条目
    );
    console.log(`[Daily-Sync] Report created: ${reportId}`);

    await updateGenerationLog(logId, {
      status: "success",
      discoveredCount: juyaResults.length,
      afterDedupCount: juyaResults.length,
      afterFilterCount: juyaResults.length,
    });

    return NextResponse.json({
      success: true,
      reportId,
      newsCount: juyaResults.length,
      date: targetDate,
      title: juyaReport.title,
    });
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "Unknown error";
    console.error("[Daily-Sync] Failed:", errorMessage);
    await updateGenerationLog(logId, { status: "failed", errorMessage });
    return NextResponse.json({ error: "每日同步失败", detail: errorMessage }, { status: 500 });
  }
}
