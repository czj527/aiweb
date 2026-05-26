import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/admin-auth";
import {
  fetchJuyaFeed,
  fetchJuyaDailyReport,
} from "@/lib/services/rss-fetch-service";
import {
  deduplicateResults,
  dedupAgainstDatabase,
  convertJuyaResults,
} from "@/lib/services/processor";
import {
  upsertNewsItems,
  createDailyReport,
  createGenerationLog,
  updateGenerationLog,
  getDailyReportByDate,
  replaceLeaderboard,
} from "@/lib/services/db-service";

// 排行榜预置数据
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

/** 安全写入日志：Supabase 不可用时跳过 */
async function safeCreateLog(type: "daily" | "weekly" | "collect" | "daily-sync" | "rss-collect" | "juya-check" | "leaderboard", targetDate: string): Promise<string | null> {
  try {
    return await createGenerationLog(type, targetDate);
  } catch {
    console.warn("[AdminSync] Cannot create log (Supabase unavailable), skipping");
    return null;
  }
}

async function safeUpdateLog(id: string | null, data: { status: string; errorMessage?: string; discoveredCount?: number; afterDedupCount?: number; afterFilterCount?: number }) {
  if (!id) return;
  try {
    await updateGenerationLog(id, data);
  } catch {
    console.warn("[AdminSync] Cannot update log (Supabase unavailable), skipping");
  }
}

/**
 * POST /api/admin/sync
 * Admin 专用同步端点，验证 admin cookie 身份
 * 
 * body: { action: "juya-check" | "daily" | "leaderboard" }
 *   - juya-check: 采集橘鸦RSS + 入库新闻 + 生成日报
 *   - daily: 仅生成日报
 *   - leaderboard: 更新全部排行榜
 */
export async function POST(request: NextRequest) {
  const token = request.cookies.get("admin_token")?.value;
  if (!token || !verifyAdminToken(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const action = body.action;

  try {
    switch (action) {
      case "juya-check":
        return await handleJuyaCheck();
      case "daily":
        return await handleDailyGenerate();
      case "leaderboard":
        return await handleLeaderboardFetch();
      default:
        return NextResponse.json(
          { error: "未知操作，支持: juya-check, daily, leaderboard" },
          { status: 400 }
        );
    }
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "Unknown error";
    console.error(`[AdminSync] ${action} failed:`, errorMessage);
    return NextResponse.json(
      { error: "操作失败", detail: errorMessage },
      { status: 500 }
    );
  }
}

/** 橘鸦同步：采集RSS + 入库新闻 + 生成日报（新闻入库不再受日报是否存在影响） */
async function handleJuyaCheck() {
  const today = new Date().toISOString().slice(0, 10);
  const logId = await safeCreateLog("juya-check", today);

  try {
    // 检查今日日报是否已存在（仅标记，不跳过新闻入库）
    let reportExists = false;
    try {
      const existing = await getDailyReportByDate(today);
      if (existing) {
        reportExists = true;
      }
    } catch {
      console.warn("[AdminSync] Cannot check existing report, proceeding anyway");
    }

    // 获取橘鸦RSS
    console.log("[AdminSync] Fetching 橘鸦 RSS");
    const juyaResults = await fetchJuyaFeed();
    console.log(`[AdminSync] Collected ${juyaResults.length} articles`);

    if (juyaResults.length === 0) {
      await safeUpdateLog(logId, { status: "no_content", errorMessage: "No content from RSS" });
      return NextResponse.json({
        success: true,
        action: "juya-check",
        message: "橘鸦RSS暂无更新",
      });
    }

    // URL去重
    const dedupedResults = deduplicateResults(juyaResults);

    // 数据库去重
    let freshResults = dedupedResults;
    try {
      freshResults = await dedupAgainstDatabase(dedupedResults, 72);
    } catch {
      console.warn("[AdminSync] Database dedup skipped (Supabase unavailable)");
    }
    console.log(`[AdminSync] After dedup: ${freshResults.length} articles`);

    // 转换格式
    const processedNews = convertJuyaResults(freshResults);

    // 新闻入库（始终执行，不受日报是否存在影响）
    try {
      await upsertNewsItems(processedNews);
    } catch {
      console.warn("[AdminSync] Cannot save news to DB (Supabase unavailable)");
    }

    // 日报创建（仅在日报不存在时执行）
    let reportId: string | null = null;
    if (!reportExists) {
      const juyaReport = await fetchJuyaDailyReport();
      try {
        if (juyaReport) {
          reportId = await createDailyReport(today, juyaReport.content, [], []);
        } else {
          reportId = await createDailyReport(today, `今日共 ${processedNews.length} 条AI资讯`, [], []);
        }
        console.log(`[AdminSync] Created daily report: ${reportId}`);
      } catch {
        console.warn("[AdminSync] Cannot create daily report in DB (Supabase unavailable)");
      }
    } else {
      console.log(`[AdminSync] Daily report already exists for ${today}, skipping report creation`);
    }

    await safeUpdateLog(logId, {
      status: "success",
      discoveredCount: juyaResults.length,
      afterDedupCount: freshResults.length,
      afterFilterCount: processedNews.length,
    });

    return NextResponse.json({
      success: true,
      action: "juya-check",
      reportId,
      newsCount: processedNews.length,
      reportSkipped: reportExists,
      message: reportExists
        ? `同步成功，${processedNews.length} 条资讯入库，日报已存在跳过创建`
        : `同步成功，${processedNews.length} 条资讯入库，日报已生成`,
    });
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "Unknown error";
    await safeUpdateLog(logId, { status: "failed", errorMessage });
    throw e;
  }
}

/** 仅生成日报 */
async function handleDailyGenerate() {
  const today = new Date().toISOString().slice(0, 10);
  const logId = await safeCreateLog("daily", today);

  try {
    if (logId) {
      try {
        const existing = await getDailyReportByDate(today);
        if (existing) {
          await safeUpdateLog(logId, { status: "skipped", errorMessage: "Report already exists" });
          return NextResponse.json({
            success: true,
            action: "daily",
            message: "今日日报已存在",
            reportId: existing.id,
          });
        }
      } catch {
        console.warn("[AdminSync] Cannot check existing report, proceeding anyway");
      }
    }

    const juyaReport = await fetchJuyaDailyReport();
    if (!juyaReport) {
      await safeUpdateLog(logId, { status: "empty", errorMessage: "No content from RSS" });
      return NextResponse.json({
        success: true,
        action: "daily",
        message: "橘鸦RSS暂无更新",
      });
    }

    let reportId: string | null = null;
    try {
      reportId = await createDailyReport(today, juyaReport.content, [], []);
    } catch {
      console.warn("[AdminSync] Cannot create daily report in DB (Supabase unavailable)");
    }

    await safeUpdateLog(logId, { status: "success" });

    return NextResponse.json({
      success: true,
      action: "daily",
      reportId,
      message: "日报生成成功",
    });
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "Unknown error";
    await safeUpdateLog(logId, { status: "failed", errorMessage });
    throw e;
  }
}

/** 更新全部排行榜 */
async function handleLeaderboardFetch() {
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
      console.error(`[AdminSync] Leaderboard ${source} failed:`, errMsg);
      results.push({ source, success: false, count: 0, error: errMsg });
    }
  }

  const allSuccess = results.every((r) => r.success);
  const totalCount = results.reduce((sum, r) => sum + r.count, 0);
  const failedSources = results.filter((r) => !r.success).map((r) => r.source);

  if (allSuccess) {
    return NextResponse.json({
      success: true,
      action: "leaderboard",
      message: `排行榜全部更新成功，共 ${totalCount} 条数据`,
      details: results,
    });
  } else {
    return NextResponse.json({
      success: false,
      action: "leaderboard",
      message: `部分排行榜更新失败：${failedSources.join(", ")}`,
      details: results,
    }, { status: 500 });
  }
}
