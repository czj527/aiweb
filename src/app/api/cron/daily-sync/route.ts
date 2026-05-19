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
  getDailyReportByDate,
  createGenerationLog,
  updateGenerationLog,
  getRecentNews,
} from "@/lib/services/db-service";

/**
 * POST /api/cron/daily-sync
 * 每日自动同步：采集橘鸦RSS → 生成日报
 *
 * 流程：
 * 1. 获取橘鸦RSS最新内容
 * 2. 去重 + 过滤
 * 3. 入库
 * 4. 生成日报文章
 * 5. 创建日报记录
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

        // Step 1: 获取橘鸦RSS
        send({ type: "step", message: "正在获取橘鸦AI早报RSS..." });
        console.log("[Daily-Sync] Step 1: Fetching 橘鸦 RSS");
        const juyaResults = await fetchJuyaFeed();
        send({ type: "progress", layer: "rss", count: juyaResults.length });
        console.log(`[Daily-Sync] 橘鸦 collected: ${juyaResults.length} articles`);

        if (juyaResults.length === 0) {
          send({ type: "error", message: "橘鸦RSS暂无更新" });
          await updateGenerationLog(logId, { status: "empty", errorMessage: "No new content from RSS" });
          controller.close();
          return;
        }

        // Step 2: 去重
        send({ type: "step", message: "去重中..." });
        console.log("[Daily-Sync] Step 2: Deduplicating");
        const dedupedResults = deduplicateResults(juyaResults);
        console.log(`[Daily-Sync] After dedup: ${dedupedResults.length}`);

        // Step 3: 72小时数据库去重
        const freshResults = await dedupAgainstDatabase(dedupedResults, 72);
        console.log(`[Daily-Sync] After 72h DB dedup: ${freshResults.length}`);

        // Step 4: 直接转换（橘鸦内容已审核，跳过AI处理）
        send({ type: "step", message: "处理中..." });
        console.log("[Daily-Sync] Step 4: Converting 橘鸦 results");
        const juyaProcessed = convertJuyaResults(freshResults);
        console.log(`[Daily-Sync] Converted: ${juyaProcessed.length} items`);

        // Step 5: 过滤
        const filtered = filterNews(juyaProcessed);
        console.log(`[Daily-Sync] After filter: ${filtered.length} items`);

        // Step 6: 入库
        send({ type: "step", message: "入库中..." });
        console.log("[Daily-Sync] Step 6: Saving to database");
        const urlToId = await upsertNewsItems(filtered);
        console.log(`[Daily-Sync] Saved ${filtered.length} items`);

        // Step 7: 获取今日所有新闻（包括之前入库的）用于生成日报
        send({ type: "step", message: "生成日报文章..." });
        console.log("[Daily-Sync] Step 7: Generating daily article");
        const recentNews = await getRecentNews(24, 50);
        const allNews = recentNews.map(n => ({
          title: n.title,
          summary: n.summary,
          quote: "",
          sourceName: n.source_name || "橘鸦AI早报",
          sourceUrl: n.source_url || "",
          category: n.category || "industry",
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
        send({ type: "step", message: "保存日报..." });
        console.log("[Daily-Sync] Step 8: Creating daily report");
        const newsIds = allNews
          .map(n => {
            // 尝试从urlToId获取ID
            for (const [url, id] of urlToId.entries()) {
              if (url === n.sourceUrl) return id;
            }
            return null;
          })
          .filter((id): id is string => !!id);

        const reportId = await createDailyReport(targetDate, overview, hotTopics, newsIds);
        console.log(`[Daily-Sync] Report created: ${reportId}`);

        await updateGenerationLog(logId, {
          status: "success",
          discoveredCount: juyaResults.length,
          afterDedupCount: dedupedResults.length,
          afterFilterCount: filtered.length,
        });

        send({
          type: "done",
          success: true,
          reportId,
          newsCount: filtered.length,
          date: targetDate,
          stats: {
            discovered: juyaResults.length,
            afterDedup: dedupedResults.length,
            afterFilter: filtered.length,
          },
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

    // Step 1: 获取橘鸦RSS
    console.log("[Daily-Sync] Step 1: Fetching 橘鸦 RSS");
    const juyaResults = await fetchJuyaFeed();
    console.log(`[Daily-Sync] 橘鸦 collected: ${juyaResults.length} articles`);

    if (juyaResults.length === 0) {
      await updateGenerationLog(logId, { status: "empty", errorMessage: "No new content from RSS" });
      return NextResponse.json({ success: true, newsCount: 0, message: "橘鸦RSS暂无更新" });
    }

    // Step 2: 去重
    console.log("[Daily-Sync] Step 2: Deduplicating");
    const dedupedResults = deduplicateResults(juyaResults);
    console.log(`[Daily-Sync] After dedup: ${dedupedResults.length}`);

    // Step 3: 72小时数据库去重
    const freshResults = await dedupAgainstDatabase(dedupedResults, 72);
    console.log(`[Daily-Sync] After 72h DB dedup: ${freshResults.length}`);

    // Step 4: 直接转换（橘鸦内容已审核，跳过AI处理）
    console.log("[Daily-Sync] Step 4: Converting 橘鸦 results");
    const juyaProcessed = convertJuyaResults(freshResults);
    console.log(`[Daily-Sync] Converted: ${juyaProcessed.length} items`);

    // Step 5: 过滤
    const filtered = filterNews(juyaProcessed);
    console.log(`[Daily-Sync] After filter: ${filtered.length} items`);

    // Step 6: 入库
    console.log("[Daily-Sync] Step 6: Saving to database");
    const urlToId = await upsertNewsItems(filtered);
    console.log(`[Daily-Sync] Saved ${filtered.length} items`);

    // Step 7: 获取今日所有新闻用于生成日报
    console.log("[Daily-Sync] Step 7: Generating daily article");
    const recentNews = await getRecentNews(24, 50);
    const allNews = recentNews.map(n => ({
      title: n.title,
      summary: n.summary,
      quote: "",
      sourceName: n.source_name || "橘鸦AI早报",
      sourceUrl: n.source_url || "",
      category: n.category || "industry",
      importanceScore: n.importance_score || 15,
      importanceLevel: n.importance_level || "S",
      keywords: (n.keywords as string[]) || [],
      isAIRelated: n.is_ai_related !== false,
      publishedAt: n.published_at || new Date().toISOString(),
      isBreaking: false,
    }));

    allNews.sort((a, b) => b.importanceScore - a.importanceScore);

    const overview = await generateDailyArticle(allNews);
    const hotTopics = extractHotTopics(allNews);

    // Step 8: 创建日报记录
    console.log("[Daily-Sync] Step 8: Creating daily report");
    const newsIds = allNews
      .map(n => {
        for (const [url, id] of urlToId.entries()) {
          if (url === n.sourceUrl) return id;
        }
        return null;
      })
      .filter((id): id is string => !!id);

    const reportId = await createDailyReport(targetDate, overview, hotTopics, newsIds);
    console.log(`[Daily-Sync] Report created: ${reportId}`);

    await updateGenerationLog(logId, {
      status: "success",
      discoveredCount: juyaResults.length,
      afterDedupCount: dedupedResults.length,
      afterFilterCount: filtered.length,
    });

    return NextResponse.json({
      success: true,
      reportId,
      newsCount: filtered.length,
      date: targetDate,
      stats: {
        discovered: juyaResults.length,
        afterDedup: dedupedResults.length,
        afterFilter: filtered.length,
      },
    });
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "Unknown error";
    console.error("[Daily-Sync] Failed:", errorMessage);
    await updateGenerationLog(logId, { status: "failed", errorMessage });
    return NextResponse.json({ error: "每日同步失败", detail: errorMessage }, { status: 500 });
  }
}
