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

// ============ 橘鸦资讯 ============

export interface JuyaNewsItem {
  title: string;
  url: string;
  quote: string;
  snippet: string;
}

export interface JuyaCategoryData {
  category: string;
  items: JuyaNewsItem[];
}

export interface JuyaNewsResponse {
  totalCount: number;
  categories: JuyaCategoryData[];
  fetchedAt: string;
}

export async function getJuyaNews(): Promise<JuyaNewsResponse> {
  return fetchAPI<JuyaNewsResponse>('/api/juya/news');
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

export async function getLeaderboard(sourceKey: string = 'datalearner-comprehensive'): Promise<LeaderboardResponse> {
  return fetchAPI<LeaderboardResponse>(`/api/leaderboard?source=${sourceKey}`);
}
