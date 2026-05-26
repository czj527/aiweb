import { getRecentNews } from "./db-service";
import { JUYA_CATEGORIES, type JuyaCategory } from "./rss-fetch-service";

/**
 * 72小时数据库去重：与数据库中已有的近期新闻比对
 * 标题相似度 > 0.6 或 URL完全匹配 即视为重复
 */
export async function dedupAgainstDatabase(
  results: SearchResult[],
  hours: number = 72
): Promise<SearchResult[]> {
  try {
    const recentNews = await getRecentNews(hours, 200);
    if (recentNews.length === 0) return results;

    const existingUrls = new Set(
      recentNews.map((n) => normalizeUrl(n.source_url)).filter(Boolean)
    );
    const existingTitles = recentNews.map((n) => n.title?.toLowerCase() || "");

    const fresh: SearchResult[] = [];
    let dupCount = 0;

    for (const r of results) {
      const normalizedUrl = normalizeUrl(r.url);

      // URL完全匹配 → 重复
      if (existingUrls.has(normalizedUrl)) {
        dupCount++;
        continue;
      }

      // 标题相似度 > 0.6 → 重复
      const isTitleDup = existingTitles.some(
        (existingTitle) =>
          titleSimilarity(existingTitle, r.title) > 0.6
      );
      if (isTitleDup) {
        dupCount++;
        continue;
      }

      fresh.push(r);
    }

    console.log(
      `[Dedup72h] Filtered ${dupCount} duplicates, ${fresh.length} remaining (from ${results.length})`
    );
    return fresh;
  } catch (e) {
    console.warn("[Dedup72h] Database dedup failed, skipping:", e);
    return results;
  }
}

/** URL标准化：去除追踪参数，统一格式 */
function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    const paramsToRemove = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'ref', 'spm', 'from', 'isappinstalled', 'nsukey', 'share_token'];
    paramsToRemove.forEach(p => u.searchParams.delete(p));
    u.pathname = u.pathname.replace(/\/+$/, '');
    return u.toString().toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

/** 标题词频相似度（Jaccard系数） */
function titleSimilarity(a: string, b: string): number {
  const wordsA = a.toLowerCase().split(/\s+/);
  const wordsB = b.toLowerCase().split(/\s+/);
  const setA = new Set(wordsA);
  const setB = new Set(wordsB);
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

/** URL去重（基于标准化URL） */
export function deduplicateResults(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  const unique: SearchResult[] = [];
  let dupCount = 0;

  for (const r of results) {
    const normalized = normalizeUrl(r.url);
    if (seen.has(normalized)) {
      dupCount++;
      continue;
    }
    seen.add(normalized);
    unique.push(r);
  }

  console.log(`[Dedup] Filtered ${dupCount} URL duplicates, ${unique.length} remaining`);
  return unique;
}

// 新闻分类体系（直接使用橘鸦分类名）
export const NEWS_CATEGORIES = JUYA_CATEGORIES;

export type NewsCategory = JuyaCategory;

// AI 处理后的结构化新闻
export interface ProcessedNews {
  title: string;
  summary: string;
  quote: string;
  sourceName: string;
  sourceUrl: string;
  category: NewsCategory;
  importanceScore: number;
  importanceLevel: string;
  keywords: string[];
  isAIRelated: boolean;
  publishedAt: string;
  isBreaking: boolean;
  juyaOrder: number;
}

// 橘鸦RSS解析结果类型
export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source?: string;
  date?: string;
  _juyaCategory?: string;
  _juyaQuote?: string;
  _juyaOrder?: number;
}

// ============================================================
// 橘鸦AI早报 → ProcessedNews 直接转换（跳过AI处理）
// ============================================================

/**
 * 将橘鸦RSS解析出的SearchResult直接转为ProcessedNews
 * 橘鸦内容已经过人工+AI审核，跳过我们的AI处理流程
 * 分类直接使用橘鸦原始分类名
 */
export function convertJuyaResults(results: SearchResult[]): ProcessedNews[] {
  const validCats = new Set<string>(NEWS_CATEGORIES);

  return results.map((r) => {
    // 分类：直接使用橘鸦原始分类名，不在已知分类中的默认归为"要闻"
    const juyaCat = r._juyaCategory || "";
    const category: NewsCategory = validCats.has(juyaCat) ? (juyaCat as NewsCategory) : "要闻";

    // 基础分25（已审核内容默认SS级）
    let baseScore = 25;
    if (category === "要闻" || category === "模型发布") baseScore += 3;
    if (category === "开发生态") baseScore += 2;

    const summary = r.snippet.length > 100 ? r.snippet : r._juyaQuote || r.snippet;
    const quote = r._juyaQuote || "";

    return {
      title: r.title,
      summary,
      quote,
      sourceName: "橘鸦AI早报",
      sourceUrl: r.url,
      category,
      importanceScore: baseScore,
      importanceLevel: baseScore >= 30 ? "SSS" : baseScore >= 22 ? "SS" : "S",
      keywords: extractKeywordsFromText(`${r.title} ${summary}`),
      isAIRelated: true,
      publishedAt: r.date ? new Date(r.date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
      isBreaking: false,
      juyaOrder: r._juyaOrder || 0,
    };
  });
}

/** 从文本中简单提取关键词 */
function extractKeywordsFromText(text: string): string[] {
  const patterns = [
    /GPT-\d[\w.]*/g, /Claude\s?\d[\w.]*/g, /Gemini\s?[\w.]+/g,
    /DeepSeek\s?[\w.]+/g, /Qwen\s?[\w.]+/g, /Llama\s?[\w.]+/g, /Grok\s?[\w.]+/g,
    /OpenAI|Anthropic|Google|Microsoft|Meta|NVIDIA|Mistral|xAI|Vercel/g,
    /Agent|MCP|RAG|MoE|RLHF|SFT|GRPO|LoRA/gi,
  ];
  const found = new Set<string>();
  for (const p of patterns) {
    const matches = text.match(p);
    if (matches) {
      matches.forEach((m) => found.add(m));
    }
  }
  return Array.from(found).slice(0, 5);
}

/**
 * 提取热门关键词（按出现频率）
 */
export function extractHotTopics(news: ProcessedNews[]): string[] {
  const keywordCount = new Map<string, number>();

  for (const n of news) {
    for (const kw of n.keywords) {
      keywordCount.set(kw, (keywordCount.get(kw) || 0) + 1);
    }
  }

  return Array.from(keywordCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([kw]) => kw);
}
