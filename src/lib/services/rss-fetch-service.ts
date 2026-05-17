// eslint-disable-next-line @typescript-eslint/no-require-imports
const Parser = require("rss-parser");
import type { SearchResult } from "./search-service";

// ============================================================
// RSS 采集服务 — 一手信息源（最可靠、最及时）
// ============================================================

/** RSS源配置 */
export interface RSSFeedConfig {
  name: string;
  url: string;
  priority: "SSS" | "SS" | "S" | "A";
  category: "official" | "media" | "community" | "academic";
  lang: "en" | "zh";
}

/** RSS源列表（按优先级排序） */
export const RSS_FEEDS: RSSFeedConfig[] = [
  // === SSS级：全球AI核心厂商官方博客 ===
  {
    name: "OpenAI Blog",
    url: "https://openai.com/blog/rss.xml",
    priority: "SSS",
    category: "official",
    lang: "en",
  },
  {
    name: "Google AI Blog",
    url: "https://blog.google/technology/ai/rss/",
    priority: "SSS",
    category: "official",
    lang: "en",
  },
  {
    name: "Google DeepMind Blog",
    url: "https://deepmind.google/blog/rss.xml",
    priority: "SSS",
    category: "official",
    lang: "en",
  },
  {
    name: "Anthropic Blog",
    url: "https://www.anthropic.com/rss.xml",
    priority: "SSS",
    category: "official",
    lang: "en",
  },
  {
    name: "Microsoft AI Blog",
    url: "https://blogs.microsoft.com/ai/feed/",
    priority: "SSS",
    category: "official",
    lang: "en",
  },
  {
    name: "Meta AI Blog",
    url: "https://ai.meta.com/blog/rss/",
    priority: "SSS",
    category: "official",
    lang: "en",
  },

  // === SS级：重要厂商 ===
  {
    name: "Hugging Face Blog",
    url: "https://huggingface.co/blog/feed.xml",
    priority: "SS",
    category: "official",
    lang: "en",
  },
  {
    name: "NVIDIA AI Blog",
    url: "https://blogs.nvidia.com/feed/",
    priority: "SS",
    category: "official",
    lang: "en",
  },
  {
    name: "Mistral AI Blog",
    url: "https://mistral.ai/feed.xml",
    priority: "SS",
    category: "official",
    lang: "en",
  },
  {
    name: "xAI Blog",
    url: "https://x.ai/blog/rss.xml",
    priority: "SS",
    category: "official",
    lang: "en",
  },
  {
    name: "Apple ML Research",
    url: "https://machinelearning.apple.com/rss.xml",
    priority: "SS",
    category: "official",
    lang: "en",
  },

  // === S级：科技媒体 ===
  {
    name: "TechCrunch AI",
    url: "https://techcrunch.com/category/artificial-intelligence/feed/",
    priority: "S",
    category: "media",
    lang: "en",
  },
  {
    name: "The Verge AI",
    url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml",
    priority: "S",
    category: "media",
    lang: "en",
  },
  {
    name: "VentureBeat AI",
    url: "https://venturebeat.com/category/ai/feed/",
    priority: "S",
    category: "media",
    lang: "en",
  },
  {
    name: "MIT Technology Review AI",
    url: "https://www.technologyreview.com/feed/",
    priority: "S",
    category: "media",
    lang: "en",
  },
  {
    name: "机器之心",
    url: "https://www.jiqizhixin.com/rss",
    priority: "S",
    category: "media",
    lang: "zh",
  },
  {
    name: "量子位",
    url: "https://www.qbitai.com/feed",
    priority: "S",
    category: "media",
    lang: "zh",
  },
  {
    name: "新智元",
    url: "https://zhidx.com/feed",
    priority: "S",
    category: "media",
    lang: "zh",
  },
  {
    name: "36kr AI",
    url: "https://36kr.com/feed",
    priority: "S",
    category: "media",
    lang: "zh",
  },
  {
    name: "Hugging Face Papers",
    url: "https://huggingface.co/papers/rss",
    priority: "SS",
    category: "academic",
    lang: "en",
  },
  {
    name: "Cohere Blog",
    url: "https://cohere.com/blog/rss.xml",
    priority: "A",
    category: "official",
    lang: "en",
  },
  {
    name: "AWS AI Blog",
    url: "https://aws.amazon.com/blogs/machine-learning/feed/",
    priority: "S",
    category: "official",
    lang: "en",
  },

  // === A级：社区与学术 ===
  {
    name: "ArXiv cs.AI",
    url: "https://rss.arxiv.org/rss/cs.AI",
    priority: "A",
    category: "academic",
    lang: "en",
  },
  {
    name: "Reddit r/LocalLLaMA",
    url: "https://www.reddit.com/r/LocalLLaMA/.rss",
    priority: "A",
    category: "community",
    lang: "en",
  },
  {
    name: "Reddit r/MachineLearning",
    url: "https://www.reddit.com/r/MachineLearning/.rss",
    priority: "A",
    category: "community",
    lang: "en",
  },
  {
    name: "Papers With Code",
    url: "https://paperswithcode.com/latest.rss",
    priority: "A",
    category: "academic",
    lang: "en",
  },
];

/** 解析后的RSS条目 */
interface _ParsedRSSItem {
  title: string;
  link: string;
  contentSnippet: string;
  content: string;
  pubDate: string;
  isoDate: string;
  source: string;
}

/** 创建rss-parser实例 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createParser(): any {
  return new Parser({
    timeout: 15000,
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; AIPulse/1.0; +https://aiweb.railway.app)",
      Accept: "application/rss+xml, application/xml, text/xml, */*",
    },
    requestOptions: {
      rejectUnauthorized: false,
    },
  });
}

/** 判断条目是否在指定时间窗口内 */
function isWithinTimeWindow(isoDate: string, hours: number): boolean {
  if (!isoDate) return true; // 无日期的保留
  try {
    const pubTime = new Date(isoDate).getTime();
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    return pubTime >= cutoff;
  } catch {
    return true;
  }
}

/** 提取纯文本摘要（去除HTML标签） */
function extractSnippet(item: Record<string, unknown>): string {
  const snippet =
    (item.contentSnippet as string) ||
    (item.content as string) ||
    (item.summary as string) ||
    (item.description as string) ||
    "";

  // 去除HTML标签
  return snippet
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

/**
 * 获取单个RSS源的最新条目
 */
async function fetchSingleFeed(
  feed: RSSFeedConfig,
  hours: number,
  maxItems: number
): Promise<SearchResult[]> {
  const parser = createParser();

  try {
    const parsed = await parser.parseURL(feed.url);

    if (!parsed.items || parsed.items.length === 0) {
      console.log(`[RSS] ${feed.name}: 0 items`);
      return [];
    }

    const results: SearchResult[] = [];

    for (const item of parsed.items) {
      if (results.length >= maxItems) break;

      const link = item.link || "";
      if (!link) continue;

      // 时间窗口过滤
      const isoDate = item.isoDate || item.pubDate || "";
      if (!isWithinTimeWindow(isoDate, hours)) continue;

      results.push({
        title: (item.title || "").trim(),
        snippet: extractSnippet(item as Record<string, unknown>),
        url: link,
        source: feed.name,
        date: isoDate,
      });
    }

    console.log(`[RSS] ${feed.name}: ${results.length} items (from ${parsed.items.length} total)`);
    return results;
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : "Unknown error";
    console.warn(`[RSS] ${feed.name} failed: ${errMsg}`);
    return [];
  }
}

/**
 * 批量获取所有RSS源
 * 并发控制：每批5个源同时请求，避免被限流
 *
 * @param hours 时间窗口（小时），默认24
 * @param maxItemsPerFeed 每个源最多返回条数，默认10
 * @param feeds 可选：指定要获取的源列表，默认全部
 */
export async function fetchAllRSSFeeds(
  hours: number = 24,
  maxItemsPerFeed: number = 10,
  feeds?: RSSFeedConfig[]
): Promise<SearchResult[]> {
  const targetFeeds = feeds || RSS_FEEDS;
  const allResults: SearchResult[] = [];
  const concurrency = 5;

  console.log(`[RSS] Fetching ${targetFeeds.length} feeds (past ${hours}h, max ${maxItemsPerFeed}/feed)`);

  for (let i = 0; i < targetFeeds.length; i += concurrency) {
    const batch = targetFeeds.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(
      batch.map((feed) => fetchSingleFeed(feed, hours, maxItemsPerFeed))
    );

    for (const result of batchResults) {
      if (result.status === "fulfilled") {
        allResults.push(...result.value);
      }
    }
  }

  console.log(`[RSS] Total collected: ${allResults.length} items from ${targetFeeds.length} feeds`);
  return allResults;
}

// ============================================================
// 橘鸦AI早报 RSS 解析器（主料源，已审核内容）
// ============================================================

/** 橘鸦分类 → 我们的 NewsCategory 映射 */
export const JUYA_CATEGORY_MAP: Record<string, string> = {
  "要闻": "model",
  "模型发布": "model",
  "开发生态": "opensource",
  "产品应用": "product",
  "技术与洞察": "research",
  "行业动态": "industry",
  "政策与治理": "policy",
  "前瞻与传闻": "rumor",
  // 兼容旧分类名
  "大模型动态": "model",
  "产品发布": "product",
  "学术研究": "research",
  "Agent 生态": "agent",
};

/** 解析后的橘鸦文章（解析中间态） */
interface JuyaParsedArticle {
  title: string;
  url: string;
  category: string;
  quote: string;
  fullText: string;
  order: number;
  pubDate: string;
}

/**
 * 从橘鸦RSS的content:encoded HTML中解析出单条新闻
 *
 * 橘鸦RSS格式（每天一条汇总）：
 * - <h3>分类名</h3> + <ul><li>标题 <a href="url">↗</a> <code>#N</code></li></ul>
 * - <hr> 分隔各条详情
 * - <h2><a href="url">标题</a> <code>#N</code></h2>
 * - <blockquote><p>引用</p></blockquote>
 * - <p>详细正文...</p>
 */
function parseJuyaHTML(html: string, pubDate: string): JuyaParsedArticle[] {
  // 去掉 CDATA 包裹
  const clean = html
    .replace(/<!\[CDATA\[/g, "")
    .replace(/\]\]>/g, "")
    .trim();

  const articles: JuyaParsedArticle[] = [];

  // --- 第一步：从概览区提取分类映射 (标题→分类) ---
  const categoryByTitle = new Map<string, string>();
  const overviewMatch = clean.match(/<h2>概览<\/h2>([\s\S]*?)(?=<hr|$)/);
  if (overviewMatch) {
    const overviewBlock = overviewMatch[1];
    let currentCategory = "";
    const lines = overviewBlock.split("\n");
    for (const line of lines) {
      const catMatch = line.match(/<h3>(.*?)<\/h3>/);
      if (catMatch) {
        currentCategory = catMatch[1].trim();
        continue;
      }
      if (currentCategory) {
        const itemMatch = line.match(/<li>(.*?)<a href="(.*?)".*?<code>#(\d+)<\/code>/);
        if (itemMatch) {
          categoryByTitle.set(itemMatch[2].trim(), currentCategory);
        }
      }
    }
  }

  // --- 第二步：按 <hr> 分割详情区，解析每条新闻 ---
  const sections = clean.split(/<hr\s*\/?>/);

  for (const section of sections) {
    // 匹配标题和链接
    const h2Match = section.match(/<h2><a href="(.*?)">(.*?)<\/a>\s*<code>#(\d+)<\/code><\/h2>/);
    if (!h2Match) continue;

    const url = h2Match[1].trim();
    const title = h2Match[2].trim();
    const order = parseInt(h2Match[3], 10);

    // 提取 blockquote（核心引用）
    const bqMatch = section.match(/<blockquote>\s*<p>([\s\S]*?)<\/p>\s*<\/blockquote>/);
    const quote = bqMatch
      ? bqMatch[1].replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim()
      : "";

    // 提取详细正文（所有 <p> 标签内容，排除 blockquote 内的）
    const withoutBq = section.replace(/<blockquote>[\s\S]*?<\/blockquote>/g, "");
    const paragraphs = [...withoutBq.matchAll(/<p>([\s\S]*?)<\/p>/g)]
      .map(m => m[1].replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim())
      .filter(p => p.length > 20 && !p.startsWith("相关链接"));
    const fullText = paragraphs.join("\n\n");

    // 分类：优先从概览区映射，否则设为空（后续用默认值）
    const mappedCategory = categoryByTitle.get(url) || "";

    articles.push({ title, url, category: mappedCategory, quote, fullText, order, pubDate });
  }

  return articles;
}

/**
 * 获取橘鸦AI早报RSS并解析为单条新闻
 * 返回的 SearchResult 已标记 source="橘鸦AI早报"，snippet 包含完整正文
 */
export async function fetchJuyaFeed(): Promise<SearchResult[]> {
  const JUYA_RSS_URL = "https://imjuya.github.io/juya-ai-daily/rss.xml";
  const parser = createParser();

  try {
    const parsed = await parser.parseURL(JUYA_RSS_URL);
    if (!parsed.items || parsed.items.length === 0) {
      console.log("[Juya] RSS: 0 items");
      return [];
    }

    // 只取最新的一条（当天的汇总）
    const latestItem = parsed.items[0];
    const contentEncoded =
      (latestItem as Record<string, unknown>)["content:encoded"] as string ||
      latestItem.content ||
      "";
    const pubDate = latestItem.isoDate || latestItem.pubDate || new Date().toISOString();

    if (!contentEncoded) {
      console.warn("[Juya] No content:encoded found");
      return [];
    }

    const articles = parseJuyaHTML(contentEncoded, pubDate);
    console.log(`[Juya] Parsed ${articles.length} articles from daily report`);

    // 转为 SearchResult 格式
    const results: SearchResult[] = articles.map((a) => ({
      title: a.title,
      snippet: a.fullText || a.quote,
      url: a.url,
      source: "橘鸦AI早报",
      date: pubDate,
      // 用 _juya 前缀标记附加信息，processor 会用到
      _juyaCategory: a.category,
      _juyaQuote: a.quote,
      _juyaOrder: a.order,
    }));

    return results;
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : "Unknown error";
    console.warn(`[Juya] RSS fetch failed: ${errMsg}`);
    return [];
  }
}

/**
 * 按优先级获取RSS源
 * SSS级先获取，不足时再获取SS级，以此类推
 */
export async function fetchRSSByPriority(
  hours: number = 24,
  maxItemsPerFeed: number = 10
): Promise<{ results: SearchResult[]; stats: Record<string, number> }> {
  const stats: Record<string, number> = {};
  const allResults: SearchResult[] = [];

  const priorityGroups: Array<{ priority: RSSFeedConfig["priority"]; feeds: RSSFeedConfig[] }> = [
    { priority: "SSS", feeds: RSS_FEEDS.filter((f) => f.priority === "SSS") },
    { priority: "SS", feeds: RSS_FEEDS.filter((f) => f.priority === "SS") },
    { priority: "S", feeds: RSS_FEEDS.filter((f) => f.priority === "S") },
    { priority: "A", feeds: RSS_FEEDS.filter((f) => f.priority === "A") },
  ];

  for (const group of priorityGroups) {
    const results = await fetchAllRSSFeeds(hours, maxItemsPerFeed, group.feeds);
    stats[group.priority] = results.length;
    allResults.push(...results);
  }

  console.log(`[RSS] Priority stats:`, stats);
  return { results: allResults, stats };
}
