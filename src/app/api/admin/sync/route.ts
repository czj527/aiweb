import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/admin-auth";
import {
  createGenerationLog,
  updateGenerationLog,
  getDailyReportByDate,
  publishAllPendingNews,
  upsertNewsItems,
  createDailyReport,
  replaceLeaderboard,
} from "@/lib/services/db-service";
import { searchDateAI } from "@/lib/services/search-service";
import { fetchMultipleURLs } from "@/lib/services/fetch-service";
import {
  deduplicateResults,
  processWithAI,
  filterNews,
  generateDailyOverview,
  extractHotTopics,
} from "@/lib/services/processor";
import { fetchURL } from "@/lib/services/fetch-service";
import { chatJSON, LLMMessage } from "@/lib/services/ai-service";

/**
 * POST /api/admin/sync
 * Admin 专用同步端点，无需 CRON_SECRET
 * 验证 admin cookie 身份后执行同步操作
 *
 * body: { action: "juya-check" | "daily" | "leaderboard" }
 *   - juya-check: 采集橘鸦RSS并生成日报（实际上是调用 news/collect + daily/generate）
 *   - daily: 仅生成日报
 *   - leaderboard: 更新排行榜
 */
export async function POST(request: NextRequest) {
  // 验证 admin 登录
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
          { error: "未知操作" },
          { status: 400 }
        );
    }
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "Unknown error";
    console.error(`[Admin Sync] Action ${action} failed:`, errorMessage);
    return NextResponse.json(
      { error: "操作失败", detail: errorMessage },
      { status: 500 }
    );
  }
}

function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function getYesterday(): string {
  return new Date(Date.now() - 86400000).toISOString().slice(0, 10);
}

/**
 * 处理 juya-check 操作：采集新闻 + 生成日报
 */
async function handleJuyaCheck() {
  const targetDate = getYesterday();

  // Step 1: 采集新闻（类似 /api/news/collect）
  console.log(`[JuyaCheck] Step 1: Collecting news for ${targetDate}`);
  const collectLogId = await createGenerationLog("collect", targetDate);

  try {
    const searchResults = await searchDateAI(targetDate);
    const discoveredCount = searchResults.length;

    const dedupedResults = deduplicateResults(searchResults);
    const afterDedupCount = dedupedResults.length;

    const topCount = Math.min(dedupedResults.length, 30);
    const topUrls = dedupedResults.slice(0, topCount).map((r) => r.url).filter(Boolean);
    const fetchResults = await fetchMultipleURLs(topUrls, { concurrency: 5, maxLength: 5000 });
    const fetchedMap = new Map(fetchResults.filter((r) => r.success).map((r) => [r.url, r]));

    const processed = await processWithAI(dedupedResults, fetchedMap);
    const filtered = filterNews(processed);
    const afterFilterCount = filtered.length;

    await upsertNewsItems(filtered);

    await updateGenerationLog(collectLogId, {
      status: "success",
      discoveredCount,
      afterDedupCount,
      afterFilterCount,
    });

    console.log(`[JuyaCheck] Collected ${afterFilterCount} news items`);
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "Collection failed";
    await updateGenerationLog(collectLogId, {
      status: "failed",
      errorMessage,
    });
    throw e;
  }

  // Step 2: 生成日报（类似 /api/daily/generate）
  const reportLogId = await createGenerationLog("daily", targetDate);

  try {
    // 检查是否已存在该日期的日报
    const existing = await getDailyReportByDate(targetDate);
    if (existing) {
      await updateGenerationLog(reportLogId, { status: "skipped", errorMessage: "Report already exists" });
      return NextResponse.json({
        success: true,
        action: "juya-check",
        message: "日报已存在，跳过生成",
        reportId: existing.id,
      });
    }

    // 发布所有待审核新闻
    const publishedCount = await publishAllPendingNews();
    console.log(`[JuyaCheck] Auto-published ${publishedCount} pending news`);

    // 重新搜索获取最新数据
    const searchResults = await searchDateAI(targetDate);
    const dedupedResults = deduplicateResults(searchResults);
    const topCount = Math.min(dedupedResults.length, 30);
    const topUrls = dedupedResults.slice(0, topCount).map((r) => r.url).filter(Boolean);
    const fetchResults = await fetchMultipleURLs(topUrls, { concurrency: 5, maxLength: 5000 });
    const fetchedMap = new Map(fetchResults.filter((r) => r.success).map((r) => [r.url, r]));

    const processed = await processWithAI(dedupedResults, fetchedMap);
    const filtered = filterNews(processed);

    const urlToId = await upsertNewsItems(filtered);
    const overview = await generateDailyOverview(filtered);
    const hotTopics = extractHotTopics(filtered);

    const newsIds = filtered
      .map((n) => urlToId.get(n.sourceUrl))
      .filter((id): id is string => !!id);

    const reportId = await createDailyReport(targetDate, overview, hotTopics, newsIds);

    await updateGenerationLog(reportLogId, {
      status: "success",
      discoveredCount: searchResults.length,
      afterDedupCount: dedupedResults.length,
      afterFilterCount: filtered.length,
    });

    console.log(`[JuyaCheck] Daily report created: ${reportId}`);

    return NextResponse.json({
      success: true,
      action: "juya-check",
      reportId,
      date: targetDate,
      message: `日报生成成功，共 ${newsIds.length} 条新闻`,
    });
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "Report generation failed";
    await updateGenerationLog(reportLogId, {
      status: "failed",
      errorMessage,
    });
    throw e;
  }
}

/**
 * 处理 daily 操作：仅生成日报
 */
async function handleDailyGenerate() {
  const targetDate = getYesterday();
  const logId = await createGenerationLog("daily", targetDate);

  try {
    // 检查是否已存在该日期的日报
    const existing = await getDailyReportByDate(targetDate);
    if (existing) {
      await updateGenerationLog(logId, { status: "skipped", errorMessage: "Report already exists" });
      return NextResponse.json({
        success: true,
        action: "daily",
        message: "该日期的日报已存在",
        reportId: existing.id,
      });
    }

    // 发布所有待审核新闻
    const publishedCount = await publishAllPendingNews();

    // 搜索并处理新闻
    const searchResults = await searchDateAI(targetDate);
    const dedupedResults = deduplicateResults(searchResults);
    const topCount = Math.min(dedupedResults.length, 30);
    const topUrls = dedupedResults.slice(0, topCount).map((r) => r.url).filter(Boolean);
    const fetchResults = await fetchMultipleURLs(topUrls, { concurrency: 5, maxLength: 5000 });
    const fetchedMap = new Map(fetchResults.filter((r) => r.success).map((r) => [r.url, r]));

    const processed = await processWithAI(dedupedResults, fetchedMap);
    const filtered = filterNews(processed);

    const urlToId = await upsertNewsItems(filtered);
    const overview = await generateDailyOverview(filtered);
    const hotTopics = extractHotTopics(filtered);

    const newsIds = filtered
      .map((n) => urlToId.get(n.sourceUrl))
      .filter((id): id is string => !!id);

    const reportId = await createDailyReport(targetDate, overview, hotTopics, newsIds);

    await updateGenerationLog(logId, {
      status: "success",
      discoveredCount: searchResults.length,
      afterDedupCount: dedupedResults.length,
      afterFilterCount: filtered.length,
    });

    return NextResponse.json({
      success: true,
      action: "daily",
      reportId,
      date: targetDate,
      message: `日报生成成功，共 ${newsIds.length} 条新闻，自动发布 ${publishedCount} 条待审核新闻`,
    });
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "Unknown error";
    await updateGenerationLog(logId, {
      status: "failed",
      errorMessage,
    });
    throw e;
  }
}

// DataLearner 排行榜配置
const LEADERBOARD_CONFIG: Record<
  string,
  {
    name: string;
    metric: string;
    url: string;
    description: string;
    fetchUrl: string;
  }
> = {
  "datalearner-aa": {
    name: "AA 智能指数",
    metric: "综合分数",
    url: "https://www.datalearner.com/leaderboards",
    description: "Artificial Analysis 智能指数",
    fetchUrl: "https://www.datalearner.com/leaderboards/external/aa-quality-index",
  },
  "datalearner-lmarena": {
    name: "LMArena 文本生成榜",
    metric: "Elo 评分",
    url: "https://www.datalearner.com/leaderboards",
    description: "基于匿名众包A/B对战的Elo评分",
    fetchUrl: "https://www.datalearner.com/leaderboards/external/text-generation",
  },
  "datalearner-benchmark": {
    name: "多基准综合评测",
    metric: "综合评分",
    url: "https://www.datalearner.com/leaderboards",
    description: "聚合多维评测排名",
    fetchUrl: "https://www.datalearner.com/leaderboards",
  },
};

/**
 * 处理 leaderboard 操作：更新排行榜
 */
async function handleLeaderboardFetch() {
  const source = "datalearner-aa";
  const category = "overall";
  const config = LEADERBOARD_CONFIG[source];

  console.log(`[Leaderboard] Fetching ${source}/${category}`);

  try {
    // Step 1: 抓取排行榜页面
    const fetchResult = await fetchURL(config.fetchUrl);

    if (!fetchResult.success || !fetchResult.content) {
      throw new Error(`无法获取 DataLearner 页面: ${fetchResult.error || "内容为空"}`);
    }

    // Step 2: 用 LLM 提取数据
    const systemPrompt = `你是AI大模型排行榜数据提取专家。以下是从 DataLearner.com 网站抓取的排行榜样页内容。

请从中提取${config.name}的排行榜数据。

规则：
1. 提取前20名的模型
2. 每条字段:
   - model_name: 模型全称含版本号
   - developer: 开发公司/组织
   - parameters: 参数量（如"1.8T"、"685B MoE"、"未知"）
   - score: 评分字符串
   - rank_position: 排名数字
   - rank_change: 与上次排名变化（正数=上升，负数=下降，无法判断填0）
   - description: 简短特点描述（8字内）
3. 严格按照页面数据提取，不要编造模型和分数
4. 如果某个模型缺少某个指标，用"-"或"未知"填充`;

    const messages: LLMMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: `页面内容：\n\n${fetchResult.content.slice(0, 15000)}` },
    ];

    const response = await chatJSON(messages, {
      responseFormat: {
        type: "json_schema",
        json_schema: {
          name: "leaderboard_entries",
          schema: {
            type: "array",
            items: {
              type: "object",
              properties: {
                model_name: { type: "string" },
                developer: { type: "string" },
                parameters: { type: "string" },
                score: { type: "string" },
                rank_position: { type: "integer" },
                rank_change: { type: "integer" },
                description: { type: "string" },
              },
              required: ["model_name", "developer", "score", "rank_position"],
            },
          },
        },
      },
    });

    const entries = response.entries || [];
    console.log(`[Leaderboard] Extracted ${entries.length} entries`);

    // Step 3: 替换数据库中的排行榜数据
    await replaceLeaderboard(source, category, entries);

    return NextResponse.json({
      success: true,
      action: "leaderboard",
      count: entries.length,
      message: `排行榜更新成功，共 ${entries.length} 条数据`,
    });
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "Unknown error";
    console.error(`[Leaderboard] Fetch failed:`, errorMessage);
    throw e;
  }
}
