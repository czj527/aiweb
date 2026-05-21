import { getSupabaseClient } from "@/storage/database/supabase-client";
import type { ProcessedNews } from "./processor";

// 数据库服务 - 日报/周报/新闻的 CRUD 操作
// 使用 Supabase SDK (PostgREST)，字段名必须用 snake_case

function getClient() {
  return getSupabaseClient();
}

/**
 * 标准化 publishedAt 为 ISO 8601 timestamp with timezone
 * LLM 可能返回不完整的日期如 "2026-05"，需要补全
 */
function normalizePublishedAt(dateStr: string): string {
  if (!dateStr) {
    return new Date().toISOString();
  }

  // 已经是完整 ISO 格式
  if (/^\d{4}-\d{2}-\d{2}T/.test(dateStr)) {
    return dateStr;
  }

  // YYYY-MM-DD 格式 → 补充时间
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return `${dateStr}T00:00:00+08:00`;
  }

  // YYYY-MM 格式 → 补充日期
  if (/^\d{4}-\d{2}$/.test(dateStr)) {
    return `${dateStr}-01T00:00:00+08:00`;
  }

  // YYYY 格式
  if (/^\d{4}$/.test(dateStr)) {
    return `${dateStr}-01-01T00:00:00+08:00`;
  }

  // 尝试解析
  try {
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  } catch {
    // ignore
  }

  // 兜底：当前时间
  return new Date().toISOString();
}

// ==================== 新闻条目 ====================

/**
 * 插入新闻条目（如已存在则跳过）
 */
export async function upsertNewsItem(news: ProcessedNews): Promise<string> {
  const client = getClient();

  // 先检查是否已存在（URL去重）
  const { data: existing, error: selectError } = await client
    .from("news_items")
    .select("id")
    .eq("source_url", news.sourceUrl)
    .limit(1);

  if (selectError) throw new Error(`查询新闻失败: ${selectError.message}`);

  if (existing && existing.length > 0) {
    return existing[0].id;
  }

  const id = crypto.randomUUID();
  const { error: insertError } = await client.from("news_items").insert({
    id,
    title: news.title,
    summary: news.summary,
    source_name: news.sourceName,
    source_url: news.sourceUrl,
    category: news.category,
    importance_score: news.importanceScore,
    importance_level: news.importanceLevel,
    keywords: news.keywords,
    is_ai_related: news.isAIRelated,
    published_at: normalizePublishedAt(news.publishedAt),
  });

  if (insertError) throw new Error(`插入新闻失败: ${insertError.message}`);

  return id;
}

/**
 * 批量插入新闻条目（优化：先批量查询已有URL，再批量插入新条目）
 */
export async function upsertNewsItems(
  newsList: ProcessedNews[]
): Promise<Map<string, string>> {
  const urlToId = new Map<string, string>();
  if (newsList.length === 0) return urlToId;

  const client = getClient();

  // Step 1: Check which URLs already exist
  const urls = newsList.map(n => n.sourceUrl);
  const { data: existing } = await client
    .from("news_items")
    .select("id, source_url")
    .in("source_url", urls);

  const existingMap = new Map<string, string>();
  for (const row of existing || []) {
    existingMap.set(row.source_url, row.id);
  }

  // Step 2: Insert new items
  const newItems: Array<Record<string, unknown>> = [];
  for (const news of newsList) {
    if (existingMap.has(news.sourceUrl)) {
      urlToId.set(news.sourceUrl, existingMap.get(news.sourceUrl)!);
      continue;
    }
    const id = crypto.randomUUID();
    newItems.push({
      id,
      title: news.title,
      summary: news.summary,
      source_name: news.sourceName,
      source_url: news.sourceUrl,
      category: news.category,
      importance_score: news.importanceScore,
      importance_level: news.importanceLevel,
      keywords: news.keywords,
      is_ai_related: news.isAIRelated,
      published_at: normalizePublishedAt(news.publishedAt),
    });
    urlToId.set(news.sourceUrl, id);
  }

  if (newItems.length > 0) {
    const { error } = await client.from("news_items").insert(newItems);
    if (error) throw new Error(`批量插入新闻失败: ${error.message}`);
  }

  return urlToId;
}

/**
 * 获取新闻详情
 */
export async function getNewsById(id: string) {
  const client = getClient();
  const { data, error } = await client
    .from("news_items")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`查询新闻详情失败: ${error.message}`);
  return data;
}

/**
 * 获取相关新闻（同分类，排除自身）
 */
export async function getRelatedNews(
  category: string,
  excludeId: string,
  limit: number = 3
) {
  const client = getClient();
  const { data, error } = await client
    .from("news_items")
    .select("*")
    .eq("category", category)
    .neq("id", excludeId)
    .order("importance_score", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`查询相关新闻失败: ${error.message}`);
  return data;
}

// ==================== 日报 ====================

/**
 * 创建日报
 */
export async function createDailyReport(
  date: string,
  overview: string,
  hotTopics: string[],
  newsIds: string[]
) {
  const client = getClient();
  const id = crypto.randomUUID();

  const { error: reportError } = await client.from("daily_reports").insert({
    id,
    report_date: date,
    overview,
    hot_topics: hotTopics,
    news_count: newsIds.length,
    status: "published",
  });

  if (reportError)
    throw new Error(`创建日报失败: ${reportError.message}`);

  // 关联新闻
  if (newsIds.length > 0) {
    const { error: newsError } = await client.from("daily_report_news").insert(
      newsIds.map((newsId, index) => ({
        report_id: id,
        news_id: newsId,
        sort_order: index,
      }))
    );

    if (newsError)
      throw new Error(`关联日报新闻失败: ${newsError.message}`);
  }

  return id;
}

/**
 * 检查指定日期是否已有日报（轻量查询）
 */
export async function getDailyReportByDate(date: string) {
  const client = getClient();
  const { data, error } = await client
    .from("daily_reports")
    .select("id, report_date")
    .eq("report_date", date)
    .limit(1);

  if (error) return null;
  return data?.[0] || null;
}

/**
 * 获取指定日期的日报
 */
export async function getDailyReport(date: string) {
  const client = getClient();

  const { data: reports, error: reportError } = await client
    .from("daily_reports")
    .select("*")
    .eq("report_date", date)
    .limit(1);

  if (reportError) throw new Error(`查询日报失败: ${reportError.message}`);
  if (!reports || reports.length === 0) return null;

  const report = reports[0];

  // 获取关联的新闻（通过 daily_report_news + news_items join）
  // Supabase 支持嵌套查询，需要外键关系
  const { data: reportNews, error: newsError } = await client
    .from("daily_report_news")
    .select("sort_order, news_items(*)")
    .eq("report_id", report.id)
    .order("sort_order");

  if (newsError) throw new Error(`查询日报新闻失败: ${newsError.message}`);

  const news =
    reportNews?.map((rn: Record<string, unknown>) => rn.news_items).filter(Boolean) || [];

  return {
    ...report,
    news,
  };
}

/**
 * 获取最新的日报
 */
export async function getLatestDailyReport() {
  const client = getClient();

  const { data: reports, error } = await client
    .from("daily_reports")
    .select("*")
    .eq("status", "published")
    .order("report_date", { ascending: false })
    .limit(1);

  if (error) throw new Error(`查询最新日报失败: ${error.message}`);
  if (!reports || reports.length === 0) return null;

  return getDailyReport(reports[0].report_date);
}

/**
 * 获取往期日报列表
 */
export async function getDailyReportList(limit: number = 7) {
  const client = getClient();
  const { data, error } = await client
    .from("daily_reports")
    .select("id, report_date, overview, news_count")
    .eq("status", "published")
    .order("report_date", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`查询日报列表失败: ${error.message}`);
  return data;
}

// ==================== 周报 ====================

/**
 * 创建周报
 */
export async function createWeeklyReport(
  weekStartDate: string,
  weekEndDate: string,
  weekNumber: number,
  overview: string,
  techTrends: string,
  industryTrends: string,
  investmentHighlights: string,
  hotTopics: string[],
  newsIds: string[]
) {
  const client = getClient();
  const id = crypto.randomUUID();

  const { error: reportError } = await client.from("weekly_reports").insert({
    id,
    week_start_date: weekStartDate,
    week_end_date: weekEndDate,
    week_number: weekNumber,
    overview,
    tech_trends: techTrends,
    industry_trends: industryTrends,
    investment_highlights: investmentHighlights,
    hot_topics: hotTopics,
    news_count: newsIds.length,
    status: "published",
  });

  if (reportError)
    throw new Error(`创建周报失败: ${reportError.message}`);

  if (newsIds.length > 0) {
    const { error: newsError } = await client
      .from("weekly_report_news")
      .insert(
        newsIds.map((newsId, index) => ({
          report_id: id,
          news_id: newsId,
          sort_order: index,
        }))
      );

    if (newsError)
      throw new Error(`关联周报新闻失败: ${newsError.message}`);
  }

  return id;
}

/**
 * 获取最新周报
 */
export async function getLatestWeeklyReport() {
  const client = getClient();

  const { data: reports, error } = await client
    .from("weekly_reports")
    .select("*")
    .eq("status", "published")
    .order("week_start_date", { ascending: false })
    .limit(1);

  if (error) throw new Error(`查询最新周报失败: ${error.message}`);
  if (!reports || reports.length === 0) return null;

  const report = reports[0];

  // 获取关联新闻
  const { data: reportNews, error: newsError } = await client
    .from("weekly_report_news")
    .select("sort_order, news_items(*)")
    .eq("report_id", report.id)
    .order("sort_order");

  if (newsError) throw new Error(`查询周报新闻失败: ${newsError.message}`);

  const news =
    reportNews?.map((rn: Record<string, unknown>) => rn.news_items).filter(Boolean) || [];

  return {
    ...report,
    news,
  };
}

/**
 * 检查指定周是否已有周报（轻量查询）
 */
export async function getWeeklyReportByDateRange(weekStart: string, weekEnd: string) {
  const client = getClient();
  const { data, error } = await client
    .from("weekly_reports")
    .select("id, week_start_date")
    .eq("week_start_date", weekStart)
    .eq("week_end_date", weekEnd)
    .limit(1);

  if (error) return null;
  return data?.[0] || null;
}

/**
 * 获取周报列表
 */
export async function getWeeklyReportList(limit: number = 4) {
  const client = getClient();
  const { data, error } = await client
    .from("weekly_reports")
    .select("id, week_start_date, week_end_date, week_number, overview, news_count")
    .eq("status", "published")
    .order("week_start_date", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`查询周报列表失败: ${error.message}`);
  return data;
}

// ==================== 排行榜 ====================

/**
 * 获取指定来源和维度的排行榜
 */
export async function getLeaderboard(source: string = "lmsys", category: string = "overall") {
  const client = getClient();
  const { data, error } = await client
    .from("model_leaderboard")
    .select("*")
    .eq("source", source)
    .eq("category", category)
    .order("rank_position");

  if (error) throw new Error(`查询排行榜失败: ${error.message}`);
  return data;
}

/**
 * 获取排行榜所有可用的来源和分类
 */
export async function getLeaderboardSources() {
  const client = getClient();
  const { data, error } = await client
    .from("model_leaderboard")
    .select("source, category, fetched_at");

  if (error) throw new Error(`查询排行榜来源失败: ${error.message}`);

  // 去重
  const sources = new Map<string, { source: string; category: string; fetchedAt: string }>();
  for (const row of data || []) {
    const key = `${row.source}:${row.category}`;
    if (!sources.has(key)) {
      sources.set(key, {
        source: row.source,
        category: row.category,
        fetchedAt: row.fetched_at,
      });
    }
  }
  return Array.from(sources.values());
}

/**
 * 替换指定来源+维度的排行榜数据（先删后插）
 */
export async function replaceLeaderboard(
  source: string,
  category: string,
  entries: {
    model_name: string;
    developer?: string;
    parameters?: string;
    score: string;
    rank_position: number;
    rank_change?: number;
    description?: string;
  }[]
) {
  const client = getClient();

  // 先删除旧数据
  const { error: deleteError } = await client
    .from("model_leaderboard")
    .delete()
    .eq("source", source)
    .eq("category", category);

  if (deleteError) throw new Error(`删除旧排行榜数据失败: ${deleteError.message}`);

  // 批量插入新数据
  if (entries.length === 0) return;

  const rows = entries.map((entry) => ({
    id: crypto.randomUUID(),
    source,
    category,
    model_name: entry.model_name,
    developer: entry.developer || null,
    parameters: entry.parameters || null,
    score: entry.score,
    rank_position: entry.rank_position,
    rank_change: entry.rank_change || 0,
    description: entry.description || null,
    fetched_at: new Date().toISOString(),
  }));

  const { error: insertError } = await client
    .from("model_leaderboard")
    .insert(rows);

  if (insertError) throw new Error(`插入排行榜数据失败: ${insertError.message}`);
}

// ==================== 生成日志 ====================

/**
 * 创建生成日志
 */
export async function createGenerationLog(
  type: "daily" | "weekly" | "collect" | "daily-sync" | "rss-collect" | "juya-check",
  targetDate: string
): Promise<string> {
  const client = getClient();
  const id = crypto.randomUUID();

  const { error } = await client.from("generation_logs").insert({
    id,
    type,
    target_date: targetDate,
    status: "running",
  });

  if (error) throw new Error(`创建生成日志失败: ${error.message}`);
  return id;
}

/**
 * 更新生成日志
 */
export async function updateGenerationLog(
  id: string,
  data: {
    status: string;
    discoveredCount?: number;
    afterDedupCount?: number;
    afterFilterCount?: number;
    errorMessage?: string;
    message?: string;
  }
) {
  const client = getClient();

  const updateData: Record<string, unknown> = {
    status: data.status,
    completed_at: new Date().toISOString(),
  };

  if (data.discoveredCount !== undefined)
    updateData.discovered_count = data.discoveredCount;
  if (data.afterDedupCount !== undefined)
    updateData.after_dedup_count = data.afterDedupCount;
  if (data.afterFilterCount !== undefined)
    updateData.after_filter_count = data.afterFilterCount;
  if (data.errorMessage !== undefined)
    updateData.error_message = data.errorMessage;

  const { error } = await client
    .from("generation_logs")
    .update(updateData)
    .eq("id", id);

  if (error) throw new Error(`更新生成日志失败: ${error.message}`);
}

// === Types ===
export interface NewsItemRow {
  id: string;
  title: string;
  summary: string | null;
  ai_detail: string | null;
  source_name: string;
  source_url: string;
  category: string;
  importance_score: number;
  importance_level: string;
  keywords: string[];
  published_at: string;
  is_ai_related: boolean;
  related_ids: string[];
  created_at: string;
}

// === Admin functions ===

export async function deleteNewsItem(id: string): Promise<void> {
  const client = getSupabaseClient();

  // First remove from daily_report_news junction
  const { error: j1 } = await client
    .from("daily_report_news")
    .delete()
    .eq("news_id", id);
  if (j1) console.error("删除日报关联失败:", j1.message);

  // Remove from weekly_report_news junction
  const { error: j2 } = await client
    .from("weekly_report_news")
    .delete()
    .eq("news_id", id);
  if (j2) console.error("删除周报关联失败:", j2.message);

  // Delete the news item itself
  const { error } = await client.from("news_items").delete().eq("id", id);
  if (error) throw new Error(`删除新闻失败: ${error.message}`);
}

export async function deleteNewsFromReports(id: string): Promise<void> {
  const client = getSupabaseClient();
  // Delete report associations first (daily)
  const { error: j1 } = await client
    .from("daily_report_news")
    .delete()
    .eq("news_id", id);
  if (j1) console.error("删除日报关联失败:", j1.message);

  // Delete report associations (weekly)
  const { error: j2 } = await client
    .from("weekly_report_news")
    .delete()
    .eq("news_id", id);
  if (j2) console.error("删除周报关联失败:", j2.message);

  // Delete the news item itself
  const { error } = await client.from("news_items").delete().eq("id", id);
  if (error) throw new Error(`删除新闻失败: ${error.message}`);
}

export async function getAllNewsItems(
  options: { date?: string; category?: string; limit?: number } = {}
): Promise<{ items: NewsItemRow[]; total: number }> {
  const client = getSupabaseClient();
  const { date, category, limit = 200 } = options;

  let query = client
    .from("news_items")
    .select("*", { count: "exact" })
    .order("importance_score", { ascending: false })
    .limit(limit);

  if (date) {
    query = query.gte("published_at", `${date}T00:00:00`).lt("published_at", `${date}T23:59:59`);
  }
  if (category) {
    query = query.eq("category", category);
  }

  const { data: items, error, count } = await query;

  if (error) throw new Error(`获取新闻列表失败: ${error.message}`);

  return { items: items || [], total: count || 0 };
}

export async function updateDailyReportNewsCount(
  reportId: string
): Promise<void> {
  const client = getSupabaseClient();

  const { count, error: countError } = await client
    .from("daily_report_news")
    .select("*", { count: "exact", head: true })
    .eq("report_id", reportId);

  if (countError)
    console.error("统计日报新闻数失败:", countError.message);

  await client
    .from("daily_reports")
    .update({ news_count: count || 0 })
    .eq("id", reportId);
}

/**
 * 获取最近 N 小时的新闻（按重要性排序），不依赖日报关联
 */
export async function getRecentNews(hours: number = 24, limit: number = 50): Promise<NewsItemRow[]> {
  const client = getSupabaseClient();
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const { data, error } = await client
    .from("news_items")
    .select("*")
    .gte("published_at", since)
    .order("importance_score", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`获取最近新闻失败: ${error.message}`);
  return data || [];
}

// ============================================================
// 审核相关函数
// ============================================================

/** 获取待审核新闻 */
export async function getPendingNews(days: number = 7): Promise<NewsItemRow[]> {
  const client = getSupabaseClient();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await client
    .from("news_items")
    .select("*")
    .eq("status", "pending")
    .gte("created_at", since)
    .order("importance_score", { ascending: false });
  if (error) throw new Error(`获取待审核新闻失败: ${error.message}`);
  return data || [];
}

/** 更新新闻状态 */
export async function updateNewsStatus(id: string, status: string, reason?: string) {
  const client = getSupabaseClient();
  const update: Record<string, unknown> = { status, reviewed_at: new Date().toISOString() };
  if (reason) update.reject_reason = reason;
  const { error } = await client
    .from("news_items")
    .update(update)
    .eq("id", id);
  if (error) throw new Error(`更新新闻状态失败: ${error.message}`);
}

/** 审核新闻（含日志） */
export async function reviewNews(id: string, action: "approve" | "reject", reason?: string) {
  const client = getSupabaseClient();
  const { data: news } = await client.from("news_items").select("status").eq("id", id).single();
  const previousStatus = news?.status || "pending";
  const newStatus = action === "approve" ? "published" : "rejected";
  await updateNewsStatus(id, newStatus, reason);
  await client.from("review_logs").insert({
    news_id: id, action, previous_status: previousStatus, new_status: newStatus, reviewer: "admin", reason
  });
}

/** 批量审核 */
export async function batchReviewNews(ids: string[], action: "approve" | "reject", reason?: string) {
  for (const id of ids) {
    await reviewNews(id, action, reason);
  }
}

/** 发布所有pending新闻（日报生成时调用） */
export async function publishAllPendingNews() {
  const client = getSupabaseClient();
  const { error } = await client
    .from("news_items")
    .update({ status: "published", reviewed_at: new Date().toISOString() })
    .eq("status", "pending");
  if (error) throw new Error(`自动发布pending新闻失败: ${error.message}`);
  console.log("[DB] All pending news auto-published");
}

/** 获取pending新闻数量 */
export async function getPendingNewsCount(): Promise<number> {
  const client = getSupabaseClient();
  const { count, error } = await client
    .from("news_items")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");
  if (error) throw new Error(`获取pending数量失败: ${error.message}`);
  return count || 0;
}

/** 编辑新闻 */
export async function editNews(id: string, updates: { title?: string; summary?: string; category?: string; importance_score?: number; importance_level?: string }) {
  const client = getSupabaseClient();
  const { error } = await client
    .from("news_items")
    .update(updates)
    .eq("id", id);
  if (error) throw new Error(`编辑新闻失败: ${error.message}`);
}
