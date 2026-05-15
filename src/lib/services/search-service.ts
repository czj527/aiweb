import { search as ddgSearch } from "duckduckgo-search";

// ============================================================
// AI Pulse 信息源配置
// ============================================================

/** 信息源优先级：SSS > SS > S > A */
export type SourcePriority = "SSS" | "SS" | "S" | "A";

export interface SourceConfig {
  name: string;
  domain: string;
  priority: SourcePriority;
  type: "rss" | "web" | "api" | "social";
  keywords: string[];
}

/** 全部信息源配置（按优先级排序） */
export const NEWS_SOURCES: SourceConfig[] = [
  // === SSS 级：全球AI核心厂商官方博客 ===
  { name: "OpenAI Blog", domain: "openai.com", priority: "SSS", type: "rss", keywords: ["GPT", "ChatGPT", "DALL-E", "Sora", "OpenAI"] },
  { name: "Google AI Blog", domain: "blog.google", priority: "SSS", type: "rss", keywords: ["Gemini", "Google AI", "DeepMind"] },
  { name: "Google DeepMind Blog", domain: "deepmind.google", priority: "SSS", type: "rss", keywords: ["AlphaFold", "DeepMind", "Gemini"] },
  { name: "Anthropic Blog", domain: "anthropic.com", priority: "SSS", type: "rss", keywords: ["Claude", "Anthropic", "constitutional AI"] },
  { name: "Microsoft AI Blog", domain: "blogs.microsoft.com", priority: "SSS", type: "rss", keywords: ["Copilot", "Azure AI", "Phi", "Microsoft AI"] },
  { name: "Meta AI Blog", domain: "ai.meta.com", priority: "SS", type: "rss", keywords: ["Llama", "Meta AI", "FAIR"] },

  // === SS 级：重要厂商与国内头部 ===
  { name: "DeepSeek", domain: "deepseek.com", priority: "SS", type: "web", keywords: ["DeepSeek", "深度求索"] },
  { name: "智谱AI", domain: "zhipuai.cn", priority: "SS", type: "web", keywords: ["GLM", "智谱AI", "ChatGLM"] },
  { name: "Hugging Face Blog", domain: "huggingface.co", priority: "SS", type: "rss", keywords: ["Hugging Face", "transformers", "open source AI"] },
  { name: "xAI Blog", domain: "x.ai", priority: "SS", type: "rss", keywords: ["Grok", "xAI"] },
  { name: "NVIDIA AI Blog", domain: "nvidia.com", priority: "SS", type: "rss", keywords: ["NVIDIA", "CUDA", "GTC", "GPU AI"] },
  { name: "Mistral AI Blog", domain: "mistral.ai", priority: "SS", type: "rss", keywords: ["Mistral", "Le Chat"] },
  { name: "Apple ML", domain: "machinelearning.apple.com", priority: "SS", type: "rss", keywords: ["Apple Intelligence", "Apple ML", "on-device AI"] },
  { name: "Qwen/阿里云", domain: "qwenlm.github.io", priority: "S", type: "web", keywords: ["Qwen", "通义千问", "阿里云AI"] },
  { name: "Moonshot AI", domain: "kimi.moonshot.cn", priority: "S", type: "web", keywords: ["Kimi", "Moonshot AI", "月之暗面"] },

  // === S 级：科技媒体 ===
  { name: "机器之心", domain: "jiqizhixin.com", priority: "S", type: "rss", keywords: ["机器之心", "AI技术"] },
  { name: "新智元", domain: "zhidx.com", priority: "S", type: "web", keywords: ["新智元", "AI产业"] },
  { name: "量子位", domain: "qbitai.com", priority: "S", type: "rss", keywords: ["量子位", "量子位AI"] },
  { name: "36kr AI", domain: "36kr.com", priority: "S", type: "rss", keywords: ["36kr", "AI创业"] },
  { name: "TechCrunch AI", domain: "techcrunch.com", priority: "S", type: "rss", keywords: ["AI startup", "AI funding"] },
  { name: "The Verge AI", domain: "theverge.com", priority: "S", type: "rss", keywords: ["AI", "artificial intelligence"] },
  { name: "VentureBeat AI", domain: "venturebeat.com", priority: "S", type: "rss", keywords: ["AI", "machine learning"] },
  { name: "MIT Technology Review", domain: "technologyreview.com", priority: "S", type: "rss", keywords: ["AI", "artificial intelligence"] },
  { name: "AWS AI Blog", domain: "aws.amazon.com", priority: "S", type: "rss", keywords: ["AWS AI", "Bedrock", "SageMaker"] },


  // === 社交媒体源 ===
  { name: "Twitter/X AI", domain: "x.com", priority: "S", type: "social", keywords: ["AI", "GPT", "Claude", "Gemini", "LLM", "agent"] },
  { name: "Nitter AI", domain: "nitter.net", priority: "A", type: "social", keywords: ["AI", "GPT", "Claude", "Gemini", "LLM"] },
  // === A 级：社区与学术 ===
  { name: "Reddit ML", domain: "reddit.com", priority: "A", type: "rss", keywords: ["MachineLearning", "artificial"] },
  { name: "ArXiv cs.AI", domain: "arxiv.org", priority: "A", type: "rss", keywords: ["cs.AI", "artificial intelligence paper"] },
  { name: "Papers With Code", domain: "paperswithcode.com", priority: "A", type: "rss", keywords: ["SOTA", "AI benchmark"] },
  { name: "Cohere Blog", domain: "cohere.com", priority: "A", type: "rss", keywords: ["Cohere", "RAG", "enterprise AI"] },
  { name: "Stanford HAI", domain: "hai.stanford.edu", priority: "A", type: "rss", keywords: ["Stanford HAI", "AI index"] },
];

/** 按优先级分组 */
export const SSS_SOURCES = NEWS_SOURCES.filter((s) => s.priority === "SSS");
export const SS_SOURCES = NEWS_SOURCES.filter((s) => s.priority === "SS");
export const S_SOURCES = NEWS_SOURCES.filter((s) => s.priority === "S");
export const A_SOURCES = NEWS_SOURCES.filter((s) => s.priority === "A");

// ============================================================
// 搜索服务 - 使用 DuckDuckGo 免费搜索
// ============================================================

export interface SearchResult {
  title: string;
  snippet: string;
  url: string;
  source: string;
  date: string;
}

/** DuckDuckGo 搜索结果项接口 */
interface DDGResult {
  title: string;
  description: string;
  url: string;
  source?: string;
  publishedDate?: string;
}

/**
 * 通用搜索 — 使用 DuckDuckGo（免费，无需 API Key）
 */
export async function searchAI(
  query: string,
  options?: { count?: number; timeRange?: string }
): Promise<SearchResult[]> {
  try {
    const results = await ddgSearch(query, {
      count: options?.count || 15,
    }) as DDGResult[];

    if (!Array.isArray(results) || results.length === 0) return [];

    return results.map((item) => ({
      title: item.title || "",
      snippet: item.description || "",
      url: item.url || "",
      source: item.source || extractDomain(item.url),
      date: item.publishedDate || "",
    }));
  } catch (e) {
    console.error(`Search failed for "${query}":`, e);
    return [];
  }
}

/** 从 URL 提取域名作为来源名称 */
function extractDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    return hostname.split(".")[0] || hostname;
  } catch {
    return "";
  }
}

/**
 * 分级搜索策略 — 日报/周报专用
 *
 * 三阶段搜索：
 * 1. 定向搜索：对 SSS/SS 级信息源逐个搜索（确保核心来源覆盖）
 * 2. 通用搜索：用多个通用查询广覆盖（捕获长尾信息）
 * 3. 媒体补充：搜索 S 级科技媒体（确保中文和产业动态覆盖）
 */
export async function searchDateAI(
  targetDate: string,
  mode: "daily" | "weekly" = "daily"
): Promise<SearchResult[]> {
  const timeRange = mode === "daily" ? "1d" : "1w";
  const allResults: SearchResult[] = [];

  // ---- 阶段1: 定向搜索核心信息源 ----
  const coreSources = [...SSS_SOURCES, ...SS_SOURCES];
  console.log(`[Search] Phase 1: Targeted search for ${coreSources.length} core sources`);

  // 按信息源关键词 + 日期组合搜索（每2个源合并一次查询，控制总请求数）
  for (let i = 0; i < coreSources.length; i += 2) {
    const batch = coreSources.slice(i, i + 2);
    const siteQuery = batch
      .map((s) => `site:${s.domain}`)
      .join(" OR ");
    const query = `(${siteQuery}) AI artificial intelligence ${targetDate}`;
    const results = await searchAI(query, { count: 10, timeRange });
    allResults.push(...results);
  }

  // ---- 阶段2: 通用广覆盖搜索 ----
  console.log(`[Search] Phase 2: General broad search`);
  const generalQueries =
    mode === "daily"
      ? [
          `AI大模型 ${targetDate} 最新动态`,
          `artificial intelligence news ${targetDate}`,
          `大模型发布 AI产品 ${targetDate}`,
          `LLM breakthrough ${targetDate} GPT Claude Gemini`,
        ]
      : [
          `AI大模型 本周 最新动态 总结`,
          `artificial intelligence this week highlights`,
          `大模型发布 AI融资 AI政策 本周`,
          `LLM release AI funding policy this week`,
        ];

  for (const query of generalQueries) {
    const results = await searchAI(query, { count: 15, timeRange });
    allResults.push(...results);
  }

  // ---- 阶段3: 中文科技媒体补充 ----
  console.log(`[Search] Phase 3: Chinese tech media supplement`);
  const mediaDomains = S_SOURCES.filter((s) =>
    ["jiqizhixin.com", "zhidx.com", "qbitai.com", "36kr.com"].includes(s.domain)
  );

  for (const media of mediaDomains) {
    const query = `site:${media.domain} AI ${targetDate}`;
    const results = await searchAI(query, { count: 5, timeRange });
    allResults.push(...results);
  }


  // ---- 阶段4: 社交媒体AI KOL动态 ----
  console.log(`[Search] Phase 4: Social media AI KOL search`);
  const socialKOLs = ["OpenAI", "AnthropicAI", "GoogleDeepMind", "ylecun", "AndrewYNg", "sama"];
  for (const kol of socialKOLs) {
    const query = `site:x.com OR site:nitter.net ${kol} AI ${targetDate}`;
    const results = await searchAI(query, { count: 5, timeRange });
    allResults.push(...results);
  }
  // ---- URL去重 ----
  const seen = new Set<string>();
  const deduped = allResults.filter((r) => {
    if (!r.url || seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });

  console.log(
    `[Search] Total: ${allResults.length} → After dedup: ${deduped.length}`
  );
  return deduped;
}
