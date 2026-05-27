import { getSupabaseClient } from "@/storage/database/supabase-client";
import type { ProcessedNews } from "./processor";

// 数据库服务 - 日报/新闻/排行榜的 CRUD 操作
// 使用 Supabase SDK (PostgREST)，字段名必须用 snake_case

function getClient() {
  return getSupabaseClient();
}

/**
 * 标准化 publishedAt 为 ISO 8601 timestamp with timezone
 */
function normalizePublishedAt(dateStr: string): string {
  if (!dateStr) return new Date().toISOString();
  if (/^\d{4}-\d{2}-\d{2}T/.test(dateStr)) return dateStr;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return `${dateStr}T00:00:00+08:00`;
  if (/^\d{4}-\d{2}$/.test(dateStr)) return `${dateStr}-01T00:00:00+08:00`;
  if (/^\d{4}$/.test(dateStr)) return `${dateStr}-01-01T00:00:00+08:00`;
  try {
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) return parsed.toISOString();
  } catch { /* ignore */ }
  return new Date().toISOString();
}

// ==================== 新闻条目 ====================

/** 插入新闻条目（如已存在则跳过） */
export async function upsertNewsItem(news: ProcessedNews): Promise<string> {
  const client = getClient();
  const { data: existing, error: selectError } = await client
    .from("news_items").select("id").eq("source_url", news.sourceUrl).limit(1);
  if (selectError) throw new Error(`查询新闻失败: ${selectError.message}`);
  if (existing && existing.length > 0) return existing[0].id;

  const id = crypto.randomUUID();
  const { error: insertError } = await client.from("news_items").insert({
    id, title: news.title, summary: news.summary, source_name: news.sourceName,
    source_url: news.sourceUrl, category: news.category, importance_score: news.importanceScore,
    importance_level: news.importanceLevel, keywords: news.keywords, is_ai_related: news.isAIRelated,
    published_at: normalizePublishedAt(news.publishedAt),
  });
  if (insertError) throw new Error(`插入新闻失败: ${insertError.message}`);
  return id;
}

/** 批量插入新闻条目 */
export async function upsertNewsItems(newsList: ProcessedNews[]): Promise<Map<string, string>> {
  const urlToId = new Map<string, string>();
  if (newsList.length === 0) return urlToId;
  const client = getClient();

  const urls = newsList.map(n => n.sourceUrl);
  const { data: existing } = await client.from("news_items").select("id, source_url").in("source_url", urls);
  const existingMap = new Map<string, string>();
  for (const row of existing || []) existingMap.set(row.source_url, row.id);

  const newItems: Array<Record<string, unknown>> = [];
  for (const news of newsList) {
    if (existingMap.has(news.sourceUrl)) { urlToId.set(news.sourceUrl, existingMap.get(news.sourceUrl)!); continue; }
    const id = crypto.randomUUID();
    newItems.push({
      id, title: news.title, summary: news.summary, source_name: news.sourceName,
      source_url: news.sourceUrl, category: news.category, importance_score: news.importanceScore,
      importance_level: news.importanceLevel, keywords: news.keywords, is_ai_related: news.isAIRelated,
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

/** 获取新闻详情 */
export async function getNewsById(id: string) {
  const client = getClient();
  const { data, error } = await client.from("news_items").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`查询新闻详情失败: ${error.message}`);
  return data;
}

// ==================== 日报 ====================

/** 创建日报 */
export async function createDailyReport(date: string, overview: string, hotTopics: string[], newsIds: string[], customNewsCount?: number) {
  const client = getClient();
  const id = crypto.randomUUID();
  const newsCount = customNewsCount !== undefined ? customNewsCount : newsIds.length;
  const { error: reportError } = await client.from("daily_reports").insert({
    id, report_date: date, overview, hot_topics: hotTopics, news_count: newsCount, status: "published",
  });
  if (reportError) throw new Error(`创建日报失败: ${reportError.message}`);

  if (newsIds.length > 0) {
    const { error: newsError } = await client.from("daily_report_news").insert(
      newsIds.map((newsId, index) => ({ report_id: id, news_id: newsId, sort_order: index }))
    );
    if (newsError) throw new Error(`关联日报新闻失败: ${newsError.message}`);
  }
  return id;
}

/** 检查指定日期是否已有日报 */
export async function getDailyReportByDate(date: string) {
  const client = getClient();
  const { data, error } = await client.from("daily_reports").select("id, report_date").eq("report_date", date).limit(1);
  if (error) return null;
  return data?.[0] || null;
}

/** 获取指定日期的日报 */
export async function getDailyReport(date: string) {
  const client = getClient();
  const { data: reports, error: reportError } = await client.from("daily_reports").select("*").eq("report_date", date).limit(1);
  if (reportError) throw new Error(`查询日报失败: ${reportError.message}`);
  if (!reports || reports.length === 0) return null;
  const report = reports[0];

  const { data: reportNews, error: newsError } = await client
    .from("daily_report_news").select("sort_order, news_items(*)").eq("report_id", report.id).order("sort_order");
  if (newsError) throw new Error(`查询日报新闻失败: ${newsError.message}`);
  const news = reportNews?.map((rn: Record<string, unknown>) => rn.news_items).filter(Boolean) || [];
  return { ...report, news };
}

/** 获取最新的日报 */
export async function getLatestDailyReport() {
  const client = getClient();
  const { data: reports, error } = await client.from("daily_reports").select("*").eq("status", "published").order("report_date", { ascending: false }).limit(1);
  if (error) throw new Error(`查询最新日报失败: ${error.message}`);
  if (!reports || reports.length === 0) return null;
  return getDailyReport(reports[0].report_date);
}

/** 获取往期日报列表 */
export async function getDailyReportList(limit: number = 7) {
  const client = getClient();
  const { data, error } = await client.from("daily_reports").select("id, report_date, overview, news_count").eq("status", "published").order("report_date", { ascending: false }).limit(limit);
  if (error) throw new Error(`查询日报列表失败: ${error.message}`);
  return data;
}

// ==================== 排行榜 ====================

/** 获取排行榜 */
export async function getLeaderboard(source: string = "lmsys", category: string = "overall") {
  const client = getClient();
  const { data, error } = await client.from("model_leaderboard").select("*").eq("source", source).eq("category", category).order("rank_position");
  if (error) throw new Error(`查询排行榜失败: ${error.message}`);
  return data;
}

/** 获取排行榜所有来源 */
export async function getLeaderboardSources() {
  const client = getClient();
  const { data, error } = await client.from("model_leaderboard").select("source, category, fetched_at");
  if (error) throw new Error(`查询排行榜来源失败: ${error.message}`);
  const sources = new Map<string, { source: string; category: string; fetchedAt: string }>();
  for (const row of data || []) {
    const key = `${row.source}:${row.category}`;
    if (!sources.has(key)) sources.set(key, { source: row.source, category: row.category, fetchedAt: row.fetched_at });
  }
  return Array.from(sources.values());
}

/** 替换排行榜数据 */
export async function replaceLeaderboard(source: string, category: string, entries: {
  model_name: string; developer?: string; parameters?: string; score: string;
  rank_position: number; rank_change?: number; description?: string;
}[]) {
  const client = getClient();
  const { error: deleteError } = await client.from("model_leaderboard").delete().eq("source", source).eq("category", category);
  if (deleteError) throw new Error(`删除旧排行榜数据失败: ${deleteError.message}`);
  if (entries.length === 0) return;

  const rows = entries.map(entry => ({
    id: crypto.randomUUID(), source, category, model_name: entry.model_name,
    developer: entry.developer || null, parameters: entry.parameters || null, score: entry.score,
    rank_position: entry.rank_position, rank_change: entry.rank_change || 0,
    description: entry.description || null, fetched_at: new Date().toISOString(),
  }));
  const { error: insertError } = await client.from("model_leaderboard").insert(rows);
  if (insertError) throw new Error(`插入排行榜数据失败: ${insertError.message}`);
}

// ==================== 生成日志 ====================

export async function createGenerationLog(type: "daily" | "weekly" | "collect" | "daily-sync" | "rss-collect" | "juya-check" | "leaderboard", targetDate: string): Promise<string> {
  const client = getClient();
  const id = crypto.randomUUID();
  const { error } = await client.from("generation_logs").insert({ id, type, target_date: targetDate, status: "running" });
  if (error) throw new Error(`创建生成日志失败: ${error.message}`);
  return id;
}

export async function updateGenerationLog(id: string, data: { status: string; discoveredCount?: number; afterDedupCount?: number; afterFilterCount?: number; errorMessage?: string; message?: string }) {
  const client = getClient();
  const updateData: Record<string, unknown> = { status: data.status, completed_at: new Date().toISOString() };
  if (data.discoveredCount !== undefined) updateData.discovered_count = data.discoveredCount;
  if (data.afterDedupCount !== undefined) updateData.after_dedup_count = data.afterDedupCount;
  if (data.afterFilterCount !== undefined) updateData.after_filter_count = data.afterFilterCount;
  if (data.errorMessage !== undefined) updateData.error_message = data.errorMessage;
  const { error } = await client.from("generation_logs").update(updateData).eq("id", id);
  if (error) throw new Error(`更新生成日志失败: ${error.message}`);
}

// ==================== Types ====================

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

// ==================== 查询 ====================

/** 获取所有新闻（带筛选） */
export async function getAllNewsItems(options: { date?: string; category?: string; limit?: number } = {}): Promise<{ items: NewsItemRow[]; total: number }> {
  const client = getSupabaseClient();
  const { date, category, limit = 200 } = options;
  let query = client.from("news_items").select("*", { count: "exact" }).order("importance_score", { ascending: false }).limit(limit);
  if (date) query = query.gte("published_at", `${date}T00:00:00`).lt("published_at", `${date}T23:59:59`);
  if (category) query = query.eq("category", category);
  const { data: items, error, count } = await query;
  if (error) throw new Error(`获取新闻列表失败: ${error.message}`);
  return { items: items || [], total: count || 0 };
}

/** 获取指定日期范围的新闻 */
export async function getNewsByDateRange(startDate: string, endDate: string, limitPerDay: number = 50): Promise<NewsItemRow[]> {
  const client = getSupabaseClient();
  const { data, error } = await client.from("news_items").select("*")
    .gte("published_at", `${startDate}T00:00:00`).lt("published_at", `${endDate}T23:59:59`)
    .order("published_at", { ascending: false }).limit(limitPerDay * 7);
  if (error) throw new Error(`获取日期范围新闻失败: ${error.message}`);
  return data || [];
}

/** 更新日报新闻数量 */
export async function updateDailyReportNewsCount(reportId: string): Promise<void> {
  const client = getSupabaseClient();
  const { count, error: countError } = await client.from("daily_report_news").select("*", { count: "exact", head: true }).eq("report_id", reportId);
  if (countError) console.error("统计日报新闻数失败:", countError.message);
  await client.from("daily_reports").update({ news_count: count || 0 }).eq("id", reportId);
}

/** 获取最近 N 小时的新闻标题和 URL（用于去重） */
export async function getRecentNews(hours: number = 24, limit: number = 50): Promise<Array<{ title: string; source_url: string }>> {
  const client = getSupabaseClient();
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const { data, error } = await client.from("news_items").select("title, source_url").gte("published_at", since).limit(limit);
  if (error) throw new Error(`获取最近新闻失败: ${error.message}`);
  return data || [];
}

/** 更新新闻状态 */
export async function updateNewsStatus(id: string, status: string, reason?: string) {
  const client = getSupabaseClient();
  const update: Record<string, unknown> = { status, reviewed_at: new Date().toISOString() };
  if (reason) update.reject_reason = reason;
  const { error } = await client.from("news_items").update(update).eq("id", id);
  if (error) throw new Error(`更新新闻状态失败: ${error.message}`);
}

/** 删除新闻条目 */
export async function deleteNewsItem(id: string): Promise<void> {
  const client = getSupabaseClient();
  await client.from("daily_report_news").delete().eq("news_id", id);
  const { error } = await client.from("news_items").delete().eq("id", id);
  if (error) throw new Error(`删除新闻失败: ${error.message}`);
}

/** 编辑新闻 */
export async function editNews(id: string, updates: { title?: string; summary?: string; category?: string; importance_score?: number; importance_level?: string }) {
  const client = getSupabaseClient();
  const { error } = await client.from("news_items").update(updates).eq("id", id);
  if (error) throw new Error(`编辑新闻失败: ${error.message}`);
}

// ==================== 周报 ====================

/** 创建周报 */
export async function createWeeklyDigest(data: {
  weekStart: string;
  weekEnd: string;
  title: string;
  summary: string;
  hotTopics: string[];
  newsCount: number;
  categories: string[];
  content: string;
}) {
  const client = getClient();
  const id = crypto.randomUUID();
  const { error } = await client.from("weekly_digests").insert({
    id,
    week_start: data.weekStart,
    week_end: data.weekEnd,
    title: data.title,
    summary: data.summary,
    hot_topics: data.hotTopics,
    news_count: data.newsCount,
    categories: data.categories,
    content: data.content,
    status: "published",
    published_at: new Date().toISOString(),
  });
  if (error) throw new Error(`创建周报失败: ${error.message}`);
  return id;
}

/** 获取周报列表 */
export async function getWeeklyDigestList(limit: number = 20) {
  const client = getClient();
  const { data, error } = await client
    .from("weekly_digests")
    .select("id, week_start, week_end, title, summary, news_count, categories, published_at")
    .eq("status", "published")
    .order("week_start", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`查询周报列表失败: ${error.message}`);
  return data || [];
}

/** 获取指定周报 */
export async function getWeeklyDigest(id: string) {
  const client = getClient();
  const { data, error } = await client
    .from("weekly_digests")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`查询周报详情失败: ${error.message}`);
  return data;
}

/** 获取指定周的周报（按week_start） */
export async function getWeeklyDigestByWeek(weekStart: string) {
  const client = getClient();
  const { data, error } = await client
    .from("weekly_digests")
    .select("*")
    .eq("week_start", weekStart)
    .limit(1);
  if (error) throw new Error(`查询周报失败: ${error.message}`);
  return data?.[0] || null;
}

// ==================== 数据清理 ====================

/** 清理过期数据：周日晚执行 */
export async function cleanupOldData(weekStart: string) {
  const client = getClient();
  const results = { newsDeleted: 0, reportsCleared: 0, associationsDeleted: 0, logsDeleted: 0 };

  // 1. 删除本周之前的新闻
  const { data: deletedNews, error: newsError } = await client
    .from("news_items")
    .delete()
    .lt("published_at", `${weekStart}T00:00:00+08:00`)
    .select("id");
  if (newsError) console.error("[cleanup] 删除新闻失败:", newsError.message);
  else results.newsDeleted = deletedNews?.length || 0;

  // 2. 清理本周之前的日报：清空正文，保留元数据
  const { data: clearedReports, error: reportError } = await client
    .from("daily_reports")
    .update({ overview: "", hot_topics: [] })
    .lt("report_date", weekStart)
    .neq("overview", "")
    .select("id");
  if (reportError) console.error("[cleanup] 清理日报失败:", reportError.message);
  else results.reportsCleared = clearedReports?.length || 0;

  // 3. 删除清理日报的关联记录
  if (clearedReports && clearedReports.length > 0) {
    const reportIds = clearedReports.map((r: { id: string }) => r.id);
    const { data: deletedAssoc, error: assocError } = await client
      .from("daily_report_news")
      .delete()
      .in("report_id", reportIds)
      .select("id");
    if (assocError) console.error("[cleanup] 删除关联失败:", assocError.message);
    else results.associationsDeleted = deletedAssoc?.length || 0;
  }

  // 4. 删除2周前的生成日志
  const twoWeeksAgo = new Date(weekStart);
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  const twoWeeksAgoStr = twoWeeksAgo.toISOString().split("T")[0];
  const { data: deletedLogs, error: logsError } = await client
    .from("generation_logs")
    .delete()
    .lt("created_at", `${twoWeeksAgoStr}T00:00:00+08:00`)
    .select("id");
  if (logsError) console.error("[cleanup] 删除日志失败:", logsError.message);
  else results.logsDeleted = deletedLogs?.length || 0;

  return results;
}

/** 获取本周起止日期（周一~周日） */
export function getWeekRange(date?: Date): { weekStart: string; weekEnd: string } {
  const d = date || new Date();
  const shanghaiStr = d.toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' });
  const shanghaiDate = new Date(shanghaiStr);
  const day = shanghaiDate.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;

  const monday = new Date(shanghaiDate);
  monday.setDate(shanghaiDate.getDate() + mondayOffset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const fmt = (dt: Date) => dt.toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' }).split(' ')[0];
  return { weekStart: fmt(monday), weekEnd: fmt(sunday) };
}
