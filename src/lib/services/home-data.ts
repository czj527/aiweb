import { getSupabaseClient } from '@/storage/database/supabase-client';
import { fetchJuyaFeed } from './rss-fetch-service';
import { deduplicateResults, dedupAgainstDatabase, convertJuyaResults } from './processor';

function toShanghaiDate(date: Date): string {
  return date.toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' }).split(' ')[0];
}

const JUYA_ORDER = ['要闻', '模型发布', '开发生态', '产品应用', '技术与洞察', '行业动态', '政策与治理', '前瞻与传闻'];

export interface HomeNewsItem {
  id: string;
  title: string;
  source: string;
  sourceUrl: string;
  summary: string;
  publishedAt: string;
}

export interface CategoryGroup {
  category: string;
  count: number;
  items: HomeNewsItem[];
}

export interface DayData {
  date: string;
  dateLabel: string;
  categories: CategoryGroup[];
  totalCount: number;
}

export async function fetchRecentNews(days: number = 7): Promise<{ days: DayData[]; isFallback: boolean }> {
  // 优先直连 Supabase
  try {
    const result = await fetchFromDB(days);
    if (result.length > 0) return { days: result, isFallback: false };
  } catch (e) {
    console.error('[HomeData] DB query failed:', e instanceof Error ? e.message : e);
  }

  // 降级到橘鸦 RSS
  try {
    const result = await fetchFromRSS();
    return { days: result, isFallback: true };
  } catch (e) {
    console.error('[HomeData] RSS fallback failed:', e instanceof Error ? e.message : e);
  }

  return { days: [], isFallback: false };
}

async function fetchFromDB(validDays: number): Promise<DayData[]> {
  const client = getSupabaseClient();
  const now = new Date();
  const todayStr = toShanghaiDate(now);
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - validDays + 1);
  const startStr = toShanghaiDate(startDate);

  const { data, error } = await client
    .from('news_items')
    .select('id, title, summary, source_name, source_url, category, published_at')
    .gte('published_at', `${startStr}T00:00:00`)
    .lt('published_at', `${todayStr}T23:59:59`)
    .order('published_at', { ascending: false })
    .limit(350);

  if (error) throw new Error(`Supabase query failed: ${error.message}`);
  if (!data || data.length === 0) return [];

  // 按日期+分类分组
  const byDate = new Map<string, Map<string, HomeNewsItem[]>>();
  for (const item of data) {
    const utcDate = new Date(item.published_at);
    const dateKey = toShanghaiDate(utcDate);
    if (!byDate.has(dateKey)) byDate.set(dateKey, new Map());
    const catMap = byDate.get(dateKey)!;
    const cat = item.category || '要闻';
    if (!catMap.has(cat)) catMap.set(cat, []);
    catMap.get(cat)!.push({
      id: item.id,
      title: item.title,
      source: item.source_name,
      sourceUrl: item.source_url,
      summary: item.summary || '',
      publishedAt: item.published_at,
    });
  }

  const yesterdayStr = toShanghaiDate(new Date(Date.now() - 86400000));
  const daysData: DayData[] = [];

  for (let i = 0; i < validDays; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = toShanghaiDate(d);
    const catMap = byDate.get(dateStr);
    if (!catMap || catMap.size === 0) continue;

    const categories = Array.from(catMap.entries())
      .map(([category, items]) => ({ category, count: items.length, items }))
      .sort((a, b) => {
        const idxA = JUYA_ORDER.indexOf(a.category);
        const idxB = JUYA_ORDER.indexOf(b.category);
        const orderA = idxA === -1 ? 999 : idxA;
        const orderB = idxB === -1 ? 999 : idxB;
        if (orderA !== orderB) return orderA - orderB;
        return b.count - a.count;
      });

    const monthDay = `${d.getMonth() + 1}月${d.getDate()}日`;
    let dateLabel: string;
    if (dateStr === todayStr) dateLabel = `今天 · ${monthDay}`;
    else if (dateStr === yesterdayStr) dateLabel = `昨天 · ${monthDay}`;
    else {
      const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
      dateLabel = `${monthDay} · ${weekdays[d.getDay()]}`;
    }

    daysData.push({ date: dateStr, dateLabel, categories, totalCount: categories.reduce((s, c) => s + c.count, 0) });
  }

  return daysData;
}

async function fetchFromRSS(): Promise<DayData[]> {
  const juyaResults = await fetchJuyaFeed();
  if (juyaResults.length === 0) return [];

  const deduped = deduplicateResults(juyaResults);
  let fresh = deduped;
  try { fresh = await dedupAgainstDatabase(deduped, 72); } catch { /* skip */ }
  const processed = convertJuyaResults(fresh);

  const catMap = new Map<string, HomeNewsItem[]>();
  for (const item of processed) {
    const cat = item.category || '要闻';
    if (!catMap.has(cat)) catMap.set(cat, []);
    catMap.get(cat)!.push({
      id: `rss-${cat}-${catMap.get(cat)!.length}`,
      title: item.title,
      source: item.sourceName || '橘鸦AI早报',
      sourceUrl: item.sourceUrl || '#',
      summary: item.summary || '',
      publishedAt: item.publishedAt,
    });
  }

  const today = new Date();
  const dateStr = toShanghaiDate(today);
  const categories = Array.from(catMap.entries())
    .map(([category, items]) => ({ category, count: items.length, items }))
    .sort((a, b) => {
      const idxA = JUYA_ORDER.indexOf(a.category);
      const idxB = JUYA_ORDER.indexOf(b.category);
      return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
    });

  return [{ date: dateStr, dateLabel: `今天 · ${today.getMonth() + 1}月${today.getDate()}日`, categories, totalCount: categories.reduce((s, c) => s + c.count, 0) }];
}
