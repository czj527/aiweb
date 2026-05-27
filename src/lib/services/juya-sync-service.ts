import {
  fetchJuyaFeed,
  fetchJuyaDailyReport,
  getAvailableDates,
} from "./rss-fetch-service";
import {
  deduplicateResults,
  dedupAgainstDatabase,
  convertJuyaResults,
} from "./processor";
import {
  upsertNewsItems,
  createDailyReport,
  createGenerationLog,
  updateGenerationLog,
  getDailyReportByDate,
  deleteDailyReportByDate,
  replaceLeaderboard,
} from "./db-service";

function toShanghaiDate(date: Date): string {
  return date.toLocaleString("sv-SE", { timeZone: "Asia/Shanghai" }).split(" ")[0];
}

async function findTodayItemIndex(): Promise<number> {
  const today = toShanghaiDate(new Date());
  try {
    const dates = await getAvailableDates();
    const match = dates.find((d) => d.date === today);
    if (match) {
      console.log(`[SyncService] Found RSS item ${match.itemIndex} for date ${today}`);
      return match.itemIndex;
    }
    const sorted = dates.sort((a, b) => b.date.localeCompare(a.date));
    const latest = sorted[0];
    console.log(`[SyncService] No exact match for ${today}, using latest RSS item ${latest.itemIndex} (${latest.date})`);
    return latest.itemIndex;
  } catch {
    console.warn("[SyncService] Cannot get available dates, falling back to index 0");
    return 0;
  }
}

export interface SyncResult {
  success: boolean;
  action: string;
  reportId?: string | null;
  newsCount?: number;
  reportSkipped?: boolean;
  message: string;
  detail?: string;
  details?: Array<{ source: string; success: boolean; count: number; error?: string }>;
}

interface LeaderboardEntry {
  model_name: string;
  developer: string;
  parameters: string;
  score: string;
  rank_position: number;
  rank_change: number;
  description: string;
}

const LEADERBOARD_DATA: Record<string, LeaderboardEntry[]> = {
  "datalearner-comprehensive": [
    { model_name: "Claude Mythos Preview", developer: "Anthropic", parameters: "未知", score: "64.70", rank_position: 1, rank_change: 0, description: "SOTA" },
    { model_name: "GPT-5.4 Pro", developer: "OpenAI", parameters: "未知", score: "58.70", rank_position: 2, rank_change: 0, description: "推理强" },
    { model_name: "Muse Spark", developer: "未知", parameters: "未知", score: "58.00", rank_position: 3, rank_change: 0, description: "新模型" },
    { model_name: "GPT-5.5 Pro", developer: "OpenAI", parameters: "未知", score: "57.20", rank_position: 4, rank_change: 0, description: "旗舰" },
    { model_name: "Opus 4.7", developer: "Anthropic", parameters: "未知", score: "54.70", rank_position: 5, rank_change: 0, description: "全能" },
    { model_name: "Kimi K2.6", developer: "Moonshot", parameters: "未知", score: "54.00", rank_position: 6, rank_change: 0, description: "最佳开源" },
    { model_name: "Claude Opus 4.6", developer: "Anthropic", parameters: "未知", score: "53.00", rank_position: 7, rank_change: 0, description: "稳定" },
    { model_name: "GLM 5.1", developer: "智谱AI", parameters: "未知", score: "52.30", rank_position: 8, rank_change: 0, description: "最佳国产" },
    { model_name: "GPT-5.5", developer: "OpenAI", parameters: "未知", score: "52.20", rank_position: 9, rank_change: 0, description: "通用" },
    { model_name: "GPT-5.4", developer: "OpenAI", parameters: "未知", score: "52.10", rank_position: 10, rank_change: 0, description: "均衡" },
  ],
  "datalearner-code": [
    { model_name: "Claude Mythos Preview", developer: "Anthropic", parameters: "未知", score: "93.90", rank_position: 1, rank_change: 0, description: "编程SOTA" },
    { model_name: "Claude Sonnet 4.5", developer: "Anthropic", parameters: "未知", score: "82.00", rank_position: 2, rank_change: 0, description: "高效" },
    { model_name: "Opus 4.5", developer: "Anthropic", parameters: "未知", score: "80.90", rank_position: 3, rank_change: 0, description: "稳定" },
    { model_name: "DeepSeek-V4-Pro", developer: "DeepSeek", parameters: "未知", score: "80.60", rank_position: 4, rank_change: 0, description: "开源强" },
    { model_name: "Gemini 3.1 Pro Preview", developer: "Google", parameters: "未知", score: "80.60", rank_position: 5, rank_change: 0, description: "多模态" },
    { model_name: "Claude Opus 4.6", developer: "Anthropic", parameters: "未知", score: "80.84", rank_position: 6, rank_change: 0, description: "全能" },
    { model_name: "Claude Sonnet 4.6", developer: "Anthropic", parameters: "未知", score: "79.60", rank_position: 7, rank_change: 0, description: "新版" },
    { model_name: "GPT-5.2", developer: "OpenAI", parameters: "未知", score: "80.00", rank_position: 8, rank_change: 0, description: "均衡" },
    { model_name: "DeepSeek-V4-Flash", developer: "DeepSeek", parameters: "未知", score: "79.00", rank_position: 9, rank_change: 0, description: "快速" },
    { model_name: "Qwen 3.6 Plus Preview", developer: "阿里云", parameters: "未知", score: "78.80", rank_position: 10, rank_change: 0, description: "国产" },
  ],
  "datalearner-agent": [
    { model_name: "Claude Opus 4.6", developer: "Anthropic", parameters: "未知", score: "91.89", rank_position: 1, rank_change: 0, description: "Agent SOTA" },
    { model_name: "Gemini 3.1 Pro Preview", developer: "Google", parameters: "未知", score: "90.80", rank_position: 2, rank_change: 0, description: "多模态" },
    { model_name: "Gemini 3.0 Flash", developer: "Google", parameters: "未知", score: "90.20", rank_position: 3, rank_change: 0, description: "快速" },
    { model_name: "GLM-5", developer: "智谱AI", parameters: "未知", score: "89.70", rank_position: 4, rank_change: 0, description: "国产强" },
    { model_name: "GLM-4.7", developer: "智谱AI", parameters: "未知", score: "87.40", rank_position: 5, rank_change: 0, description: "稳定" },
    { model_name: "Qwen3.5-397B-A17B", developer: "阿里云", parameters: "未知", score: "86.70", rank_position: 6, rank_change: 0, description: "MoE" },
    { model_name: "Gemini 3.0 Pro", developer: "Google", parameters: "未知", score: "85.40", rank_position: 7, rank_change: 0, description: "通用" },
    { model_name: "Claude Sonnet 4.5", developer: "Anthropic", parameters: "未知", score: "84.70", rank_position: 8, rank_change: 0, description: "高效" },
    { model_name: "GPT-5.2", developer: "OpenAI", parameters: "未知", score: "82.00", rank_position: 9, rank_change: 0, description: "均衡" },
    { model_name: "Opus 4.5", developer: "Anthropic", parameters: "未知", score: "81.99", rank_position: 10, rank_change: 0, description: "旧版" },
  ],
};

const SOURCE_DB_MAP: Record<string, { dbSource: string; dbCategory: string }> = {
  "datalearner-comprehensive": { dbSource: "datalearner", dbCategory: "comprehensive" },
  "datalearner-code": { dbSource: "datalearner", dbCategory: "code" },
  "datalearner-agent": { dbSource: "datalearner", dbCategory: "agent" },
};

async function safeCreateLog(type: "daily" | "weekly" | "collect" | "daily-sync" | "rss-collect" | "juya-check" | "leaderboard", targetDate: string): Promise<string | null> {
  try {
    return await createGenerationLog(type, targetDate);
  } catch {
    console.warn("[SyncService] Cannot create log (Supabase unavailable), skipping");
    return null;
  }
}

async function safeUpdateLog(id: string | null, data: { status: string; errorMessage?: string; discoveredCount?: number; afterDedupCount?: number; afterFilterCount?: number; message?: string }) {
  if (!id) return;
  try {
    await updateGenerationLog(id, data);
  } catch {
    console.warn("[SyncService] Cannot update log (Supabase unavailable), skipping");
  }
}

export async function syncJuyaCheck(): Promise<SyncResult> {
  const today = toShanghaiDate(new Date());
  const logId = await safeCreateLog("juya-check", today);

  try {
    let reportExists = false;
    try {
      const existing = await getDailyReportByDate(today);
      if (existing) reportExists = true;
    } catch {
      console.warn("[SyncService] Cannot check existing report, proceeding anyway");
    }

    console.log("[SyncService] Fetching 橘鸦 RSS");
    const itemIndex = await findTodayItemIndex();
    const juyaResults = await fetchJuyaFeed(itemIndex);
    console.log(`[SyncService] Collected ${juyaResults.length} articles (RSS item ${itemIndex})`);

    if (juyaResults.length === 0) {
      await safeUpdateLog(logId, { status: "no_content", errorMessage: "No content from RSS" });
      return { success: true, action: "juya-check", message: "橘鸦RSS暂无更新" };
    }

    const dedupedResults = deduplicateResults(juyaResults);

    let freshResults = dedupedResults;
    try {
      freshResults = await dedupAgainstDatabase(dedupedResults, 72);
    } catch {
      console.warn("[SyncService] Database dedup skipped (Supabase unavailable)");
    }
    console.log(`[SyncService] After dedup: ${freshResults.length} articles`);

    const processedNews = convertJuyaResults(freshResults);

    try {
      await upsertNewsItems(processedNews);
    } catch {
      console.warn("[SyncService] Cannot save news to DB (Supabase unavailable)");
    }

    let reportId: string | null = null;
    const juyaReport = await fetchJuyaDailyReport(itemIndex);
    try {
      if (juyaReport) {
        if (reportExists) {
          await deleteDailyReportByDate(today);
          console.log(`[SyncService] Deleted stale report for ${today}`);
        }
        const newsNums = juyaReport.content.match(/#(\d+)<\/code>/g);
        const overviewNewsCount = newsNums ? Math.max(...newsNums.map(m => parseInt(m.match(/#(\d+)/)?.[1] || '0', 10))) : processedNews.length;
        reportId = await createDailyReport(today, juyaReport.content, [], [], overviewNewsCount);
        console.log(`[SyncService] Created daily report for ${today}: ${reportId}`);
      } else {
        console.warn("[SyncService] No RSS report content available");
      }
    } catch {
      console.warn("[SyncService] Cannot create daily report in DB (Supabase unavailable)");
    }

    await safeUpdateLog(logId, {
      status: "success",
      discoveredCount: juyaResults.length,
      afterDedupCount: freshResults.length,
      afterFilterCount: processedNews.length,
    });

    return {
      success: true,
      action: "juya-check",
      reportId,
      newsCount: processedNews.length,
      reportSkipped: reportExists,
      message: reportExists
        ? `同步成功，${processedNews.length} 条资讯入库，日报已存在跳过创建`
        : `同步成功，${processedNews.length} 条资讯入库，日报已生成`,
    };
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "Unknown error";
    await safeUpdateLog(logId, { status: "failed", errorMessage });
    return { success: false, action: "juya-check", message: "同步失败", detail: errorMessage };
  }
}

export async function syncDailyGenerate(): Promise<SyncResult> {
  const today = toShanghaiDate(new Date());
  const logId = await safeCreateLog("daily", today);

  try {
    const itemIndex = await findTodayItemIndex();
    const juyaReport = await fetchJuyaDailyReport(itemIndex);
    if (!juyaReport) {
      await safeUpdateLog(logId, { status: "empty", errorMessage: "No content from RSS" });
      return { success: true, action: "daily", message: "橘鸦RSS暂无更新" };
    }

    try {
      const existing = await getDailyReportByDate(today);
      if (existing) {
        await deleteDailyReportByDate(today);
        console.log(`[SyncService] Deleted stale report for ${today}`);
      }
    } catch {
      console.warn("[SyncService] Cannot check/delete existing report, proceeding anyway");
    }

    let reportId: string | null = null;
    try {
      const newsNums = juyaReport.content.match(/#(\d+)<\/code>/g);
      const overviewNewsCount = newsNums ? Math.max(...newsNums.map(m => parseInt(m.match(/#(\d+)/)?.[1] || '0', 10))) : 0;
      reportId = await createDailyReport(today, juyaReport.content, [], [], overviewNewsCount);
    } catch {
      console.warn("[SyncService] Cannot create daily report in DB (Supabase unavailable)");
    }

    await safeUpdateLog(logId, { status: "success" });

    return { success: true, action: "daily", reportId, message: "日报生成成功" };
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "Unknown error";
    await safeUpdateLog(logId, { status: "failed", errorMessage });
    return { success: false, action: "daily", message: "日报生成失败", detail: errorMessage };
  }
}

export async function syncLeaderboard(): Promise<SyncResult> {
  const sources = ["datalearner-comprehensive", "datalearner-code", "datalearner-agent"];
  const results: Array<{ source: string; success: boolean; count: number; error?: string }> = [];

  for (const source of sources) {
    const entries = LEADERBOARD_DATA[source];
    const dbMapping = SOURCE_DB_MAP[source];

    if (!entries || !dbMapping) {
      results.push({ source, success: false, count: 0, error: "未知数据源" });
      continue;
    }

    try {
      await replaceLeaderboard(dbMapping.dbSource, dbMapping.dbCategory, entries);
      results.push({ source, success: true, count: entries.length });
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : "Unknown error";
      console.error(`[SyncService] Leaderboard ${source} failed:`, errMsg);
      results.push({ source, success: false, count: 0, error: errMsg });
    }
  }

  const allSuccess = results.every((r) => r.success);
  const totalCount = results.reduce((sum, r) => sum + r.count, 0);
  const failedSources = results.filter((r) => !r.success).map((r) => r.source);

  if (allSuccess) {
    return {
      success: true,
      action: "leaderboard",
      message: `排行榜全部更新成功，共 ${totalCount} 条数据`,
      details: results,
    };
  } else {
    return {
      success: false,
      action: "leaderboard",
      message: `部分排行榜更新失败：${failedSources.join(", ")}`,
      details: results,
    };
  }
}

export async function syncRssCollect(): Promise<SyncResult> {
  const today = toShanghaiDate(new Date());
  const logId = await safeCreateLog("rss-collect", today);

  try {
    console.log("[SyncService] Collecting 橘鸦 RSS");
    const itemIndex = await findTodayItemIndex();
    const juyaResults = await fetchJuyaFeed(itemIndex);
    console.log(`[SyncService] Collected ${juyaResults.length} articles (RSS item ${itemIndex})`);

    if (juyaResults.length === 0) {
      await safeUpdateLog(logId, { status: "no_content", errorMessage: "No content from RSS" });
      return { success: true, action: "collect", message: "橘鸦RSS暂无更新" };
    }

    const dedupedResults = deduplicateResults(juyaResults);

    let freshResults = dedupedResults;
    try {
      freshResults = await dedupAgainstDatabase(dedupedResults, 72);
    } catch {
      console.warn("[SyncService] Database dedup skipped");
    }

    const processedNews = convertJuyaResults(freshResults);

    try {
      await upsertNewsItems(processedNews);
    } catch {
      console.warn("[SyncService] Cannot save news to DB");
    }

    await safeUpdateLog(logId, {
      status: "success",
      discoveredCount: juyaResults.length,
      afterDedupCount: freshResults.length,
      afterFilterCount: processedNews.length,
    });

    return {
      success: true,
      action: "collect",
      newsCount: processedNews.length,
      message: `采集完成，${processedNews.length} 条资讯入库`,
    };
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "Unknown error";
    await safeUpdateLog(logId, { status: "failed", errorMessage });
    return { success: false, action: "collect", message: "采集失败", detail: errorMessage };
  }
}
