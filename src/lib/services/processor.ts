import { getRecentNews } from "./db-service";
import { JUYA_CATEGORY_MAP as JUYA_CAT_MAP } from "./rss-fetch-service";

// NewsCategory is defined locally below (from NEWS_CATEGORIES)

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
        (existingTitle) => titleSimilarity(existingTitle, r.title) > 0.6
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

// 新闻分类体系（对齐橘鸦AI早报8分类）
export const NEWS_CATEGORIES = [
  "model",      // 模型发布：新模型、模型更新、评测榜单
  "opensource", // 开源项目：开源模型/工具/框架发布
  "product",    // 产品应用：AI产品/应用发布或重大更新
  "policy",     // 行业政策：AI政策、法规、行业标准
  "research",   // 技术与洞察：技术解析、研究报告、学术论文
  "agent",      // Agent：AI Agent框架/产品/进展
  "industry",   // 行业动态：融资、收购、人事变动、市场格局
  "rumor",      // 前瞻与传闻：未确认消息、预告、规划
] as const;

export type NewsCategory = (typeof NEWS_CATEGORIES)[number];

// AI 处理后的结构化新闻
export interface ProcessedNews {
  title: string;
  summary: string;
  quote: string;           // 引用原文（1-2句核心事实，blockquote格式）
  sourceName: string;
  sourceUrl: string;
  category: NewsCategory;
  importanceScore: number;  // 8-40
  importanceLevel: string;  // SSS / SS / S / A
  keywords: string[];
  isAIRelated: boolean;
  publishedAt: string;
  isBreaking: boolean;     // 是否为当日要闻（最重要的1-3条）
}

// 橘鸦RSS解析结果类型（与rss-fetch-service保持一致）
export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source?: string;
  date?: string;
  _juyaCategory?: string;
  _juyaQuote?: string;
}

// ============================================================
// 橘鸦AI早报 → ProcessedNews 直接转换（跳过AI处理）
// ============================================================

/** 橘鸦分类名 → NewsCategory 映射（复用 rss-fetch-service 的定义） */
const JUYA_CATEGORY_MAP: Record<string, NewsCategory> = JUYA_CAT_MAP as Record<string, NewsCategory>;

/**
 * 将橘鸦RSS解析出的SearchResult直接转为ProcessedNews
 * 橘鸦内容已经过人工+AI审核，跳过我们的AI处理流程
 * 给予较高的基础分（已审核内容），同时保留评分排序能力
 */
export function convertJuyaResults(results: SearchResult[]): ProcessedNews[] {
  return results.map((r) => {
    // 映射分类
    const juyaCat = r._juyaCategory || "";
    const category = JUYA_CATEGORY_MAP[juyaCat] || "industry";

    // 基础分25（已审核内容默认SS级），再根据内容微调
    let baseScore = 25;

    // 模型发布和Agent相关给更高基础分
    if (category === "model" || category === "agent") baseScore += 3;
    // 开源项目
    if (category === "opensource") baseScore += 2;

    // 摘要：如果fullText足够长就用，否则用quote
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
      isAIRelated: true, // 橘鸦内容已确认AI相关
      publishedAt: r.date ? new Date(r.date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
      isBreaking: false,
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
