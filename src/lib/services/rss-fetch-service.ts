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
];

/** 解析后的RSS条目 */
interface ParsedRSSItem {
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
