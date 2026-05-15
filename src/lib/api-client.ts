/**
 * API 客户端 - 前端调用后端 API 的统一入口
 */

const BASE_URL = '';

async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || `API Error: ${res.status}`);
  }

  const json = await res.json();
  // API returns { success: true, data: ... } or direct data
  if (json && typeof json === 'object' && 'success' in json && 'data' in json) {
    return json.data as T;
  }
  return json as T;
}

// ============ 日报 ============

export interface DailyReportResponse {
  id: string;
  reportDate: string;
  overview: string;
  hotTopics: string[];
  newsCount: number;
  news: NewsItemResponse[];
  createdAt: string;
}

export interface NewsItemResponse {
  id: string;
  title: string;
  summary: string;
  aiDetail: string | null;
  source: string;
  sourceUrl: string;
  category: string;
  importanceScore: number;
  importanceLevel: string;
  keywords: string[];
  publishedAt: string;
  relatedIds: string[];
}

export async function getLatestDaily(topOnly = true): Promise<DailyReportResponse> {
  return fetchAPI<DailyReportResponse>(`/api/daily${topOnly ? '?topOnly=true' : ''}`);
}

export async function getDailyByDate(date: string): Promise<DailyReportResponse> {
  return fetchAPI<DailyReportResponse>(`/api/daily?date=${date}`);
}

export async function generateDaily(): Promise<{ success: boolean; reportId: string; stats: { discovered: number; afterDedup: number; afterFilter: number } }> {
  return fetchAPI('/api/daily/generate', { method: 'POST' });
}

// ============ 周报 ============

export interface WeeklyReportResponse {
  id: string;
  weekNumber: number;
  weekStart: string;
  weekEnd: string;
  overview: string;
  techTrends: string;
  industryTrends: string;
  investmentHighlights: string;
  hotTopics: string[];
  newsCount: number;
  trends: string[];
  news: NewsItemResponse[];
  createdAt: string;
}

export async function getLatestWeekly(): Promise<WeeklyReportResponse> {
  return fetchAPI<WeeklyReportResponse>('/api/weekly');
}

export async function getWeeklyByDate(date: string): Promise<WeeklyReportResponse> {
  return fetchAPI<WeeklyReportResponse>(`/api/weekly?date=${date}`);
}

export async function generateWeekly(): Promise<{ success: boolean; reportId: string }> {
  return fetchAPI('/api/weekly/generate', { method: 'POST' });
}

// ============ 新闻详情 ============

export interface NewsDetailResponse extends NewsItemResponse {
  multiSourceViews: { source: string; title: string; summary: string; url: string }[];
}

export async function getNewsDetail(id: string): Promise<NewsDetailResponse> {
  return fetchAPI<NewsDetailResponse>(`/api/news?id=${id}`);
}

// ============ 排行榜 ============

export interface LeaderboardEntry {
  id: string;
  modelName: string;
  developer: string | null;
  parameters: string | null;
  score: number;
  rankPosition: number;
  rankChange: number;
  description: string | null;
}

export interface LeaderboardResponse {
  source: string;
  sourceLabel: string;
  sourceUrl: string;
  sourceDescription: string;
  metric: string;
  rankings: LeaderboardEntry[];
  fetchedAt: string | null;
}

export async function getLeaderboard(sourceKey: string = 'datalearner-aa'): Promise<LeaderboardResponse> {
  return fetchAPI<LeaderboardResponse>(`/api/leaderboard?source=${sourceKey}`);
}

// ============ 分类配置 ============

export const categoryConfig: Record<string, { label: string; color: string }> = {
  model: { label: '大模型动态', color: 'text-blue-500' },
  agent: { label: 'Agent', color: 'text-purple-500' },
  opensource: { label: '开源项目', color: 'text-emerald-500' },
  product: { label: '产品发布', color: 'text-green-500' },
  policy: { label: '行业政策', color: 'text-amber-500' },
  research: { label: '学术研究', color: 'text-cyan-500' },
  industry: { label: '行业动态', color: 'text-orange-500' },
};

// ===== Admin APIs =====

export async function adminLogin(password: string): Promise<{ success: boolean; token?: string; error?: string }> {
  return fetchAPI('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
}

export async function adminVerify(token: string): Promise<{ success: boolean }> {
  return fetchAPI('/api/admin/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
  });
}

export async function adminDeleteNews(token: string, newsId: string): Promise<{ success: boolean }> {
  return fetchAPI(`/api/admin/news?id=${newsId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` },
  });
}

export async function adminTriggerGenerate(token: string, type: 'daily' | 'weekly' | 'leaderboard'): Promise<{ success: boolean; data?: unknown }> {
  const endpoint = type === 'leaderboard'
    ? '/api/leaderboard/fetch'
    : `/api/${type}/generate`;
  return fetchAPI(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ source: 'datalearner', category: 'aa-index' }),
  });
}

// ===== All News Page API =====

export async function getAllNews(reportDate?: string): Promise<DailyReportResponse | null> {
  const query = reportDate ? `?date=${reportDate}` : '';
  return fetchAPI(`/api/daily${query}`);
}
