// eslint-disable-next-line @typescript-eslint/no-require-imports
const Parser = require("rss-parser");

// ============================================================
// 橘鸦AI早报 RSS 采集服务（单一信息源）
// ============================================================

/** 橘鸦分类（直接使用橘鸦原始分类名作为内部key） */
export const JUYA_CATEGORIES = [
  "要闻",
  "模型发布",
  "开发生态",
  "产品应用",
  "技术与洞察",
  "行业动态",
  "政策与治理",
  "前瞻与传闻",
] as const;

export type JuyaCategory = (typeof JUYA_CATEGORIES)[number];

/** RSS源地址 */
const JUYA_RSS_URL = "https://imjuya.github.io/juya-ai-daily/rss.xml";

/** 创建RSS解析器 */
function createParser() {
  return new Parser({
    customFields: {
      item: [["content:encoded", "contentEncoded"]],
    },
  });
}

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

function parseJuyaHTML(html: string, pubDate: string): JuyaParsedArticle[] {
  const clean = html.replace(/<!\[CDATA\[/g, "").replace(/\]\]>/g, "").trim();
  const articles: JuyaParsedArticle[] = [];

  const categoryByTitle = new Map<string, string>();
  const urlByTitle = new Map<string, string>();
  const overviewMatch = clean.match(/<h2>概览<\/h2>([\s\S]*?)(?=<hr|$)/);
  if (overviewMatch) {
    const overviewBlock = overviewMatch[1];
    let currentCategory = "";
    const lines = overviewBlock.split("\n");
    for (const line of lines) {
      const catMatch = line.match(/<h3>(.*?)<\/h3>/);
      if (catMatch) { currentCategory = catMatch[1].trim(); continue; }
      if (currentCategory) {
        const itemWithLink = line.match(/<li>(.*?)<a href="(.*?)".*?<code>#(\d+)<\/code>/);
        const itemWithoutLink = line.match(/<li>(.*?)<code>#(\d+)<\/code>/);
        if (itemWithLink) {
          categoryByTitle.set(itemWithLink[1].trim(), currentCategory);
          urlByTitle.set(itemWithLink[1].trim(), itemWithLink[2].trim());
        } else if (itemWithoutLink) {
          categoryByTitle.set(itemWithoutLink[1].trim(), currentCategory);
        }
      }
    }
  }

  const sections = clean.split(/<hr\s*\/?>/);
  for (const section of sections) {
    let url = "", title = "", order = 0;
    const h2WithLink = section.match(/<h2><a href="(.*?)">(.*?)<\/a>\s*<code>#(\d+)<\/code><\/h2>/);
    if (h2WithLink) {
      url = h2WithLink[1].trim(); title = h2WithLink[2].trim(); order = parseInt(h2WithLink[3], 10);
    } else {
      const h2NoLink = section.match(/<h2>(.*?)<code>#(\d+)<\/code><\/h2>/);
      if (!h2NoLink) continue;
      title = h2NoLink[1].trim(); order = parseInt(h2NoLink[2], 10);
      url = urlByTitle.get(title) || "";
    }
    const bqMatch = section.match(/<blockquote>\s*<p>([\s\S]*?)<\/p>\s*<\/blockquote>/);
    const quote = bqMatch ? bqMatch[1].replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim() : "";
    const withoutBq = section.replace(/<blockquote>[\s\S]*?<\/blockquote>/g, "");
    const paragraphs = [...withoutBq.matchAll(/<p>([\s\S]*?)<\/p>/g)]
      .map((m: RegExpMatchArray) => m[1].replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim())
      .filter((p: string) => p.length > 20 && !p.startsWith("相关链接"));
    const fullText = paragraphs.join("\n\n");
    const mappedCategory = categoryByTitle.get(title) || "";
    articles.push({ title, url, category: mappedCategory, quote, fullText, order, pubDate });
  }
  return articles;
}

/** 获取并缓存RSS解析结果 */
let cachedFeed: { items: Array<Record<string, unknown>> } | null = null;
let cachedAt = 0;
const FEED_CACHE_TTL = 5 * 60 * 1000;

async function getParsedFeed() {
  const now = Date.now();
  if (cachedFeed && now - cachedAt < FEED_CACHE_TTL) return cachedFeed;
  const parser = createParser();
  const parsed = await parser.parseURL(JUYA_RSS_URL);
  cachedFeed = parsed; cachedAt = now;
  return parsed;
}

/**
 * 获取橘鸦AI早报RSS并解析为单条新闻列表
 * @param itemIndex RSS item索引，0=最新，默认0
 */
export async function fetchJuyaFeed(itemIndex: number = 0): Promise<Array<{
  title: string; url: string; snippet: string; source?: string; date?: string;
  _juyaCategory?: string; _juyaQuote?: string; _juyaOrder?: number;
}>> {
  try {
    const parsed = await getParsedFeed();
    if (!parsed.items || parsed.items.length === 0) return [];
    const idx = Math.min(itemIndex, parsed.items.length - 1);
    const item = parsed.items[idx];
    const contentEncoded = (item as Record<string, unknown>)["contentEncoded"] as string ||
      (item as Record<string, unknown>)["content:encoded"] as string ||
      (item as Record<string, unknown>).content as string || "";
    const pubDate = (item.isoDate || item.pubDate || new Date().toISOString()) as string;
    if (!contentEncoded) { console.warn("[Juya] No content:encoded found"); return []; }
    const articles = parseJuyaHTML(contentEncoded, pubDate);
    console.log(`[Juya] Parsed ${articles.length} articles from daily report (item ${idx})`);
    return articles.map((a) => ({
      title: a.title, snippet: a.fullText || a.quote, url: a.url,
      source: "橘鸦AI早报", date: pubDate,
      _juyaCategory: a.category, _juyaQuote: a.quote, _juyaOrder: a.order,
    }));
  } catch (e) {
    console.warn(`[Juya] RSS fetch failed: ${e instanceof Error ? e.message : "Unknown error"}`);
    return [];
  }
}

/**
 * 获取橘鸦AI早报的完整内容（用于日报展示）
 * @param itemIndex RSS item索引，0=最新，默认0
 */
export async function fetchJuyaDailyReport(itemIndex: number = 0): Promise<{
  title: string; date: string; content: string; issueNumber: number;
} | null> {
  try {
    const parsed = await getParsedFeed();
    if (!parsed.items || parsed.items.length === 0) return null;
    const idx = Math.min(itemIndex, parsed.items.length - 1);
    const item = parsed.items[idx];
    const contentEncoded = (item as Record<string, unknown>)["contentEncoded"] as string ||
      (item as Record<string, unknown>)["content:encoded"] as string ||
      (item as Record<string, unknown>).content as string || "";
    const title = (item.title || "AI 早报") as string;
    const pubDate = (item.isoDate || item.pubDate || new Date().toISOString()) as string;
    if (!contentEncoded) { console.warn("[Juya] No content:encoded found"); return null; }
    const issueMatch = title.match(/#(\d+)/);
    const issueNumber = issueMatch ? parseInt(issueMatch[1], 10) : 0;
    const dateMatch = pubDate.match(/(\d{4}-\d{2}-\d{2})/);
    const date = dateMatch ? dateMatch[1] : new Date().toISOString().slice(0, 10);
    const cleanContent = contentEncoded.replace(/<!\[CDATA\[/g, "").replace(/\]\]>/g, "").trim();
    return { title, date, content: cleanContent, issueNumber };
  } catch (e) {
    console.warn(`[Juya] RSS fetch failed: ${e instanceof Error ? e.message : "Unknown error"}`);
    return null;
  }
}

/** 获取RSS中可用的日期列表 */
export async function getAvailableDates(): Promise<Array<{ date: string; title: string; itemIndex: number }>> {
  try {
    const parsed = await getParsedFeed();
    if (!parsed.items) return [];
    return parsed.items.map((item: Record<string, unknown>, idx: number) => {
      const title = (item.title || "") as string;
      const pubDate = (item.isoDate || item.pubDate || "") as string;
      const dateMatch = pubDate.match(/(\d{4}-\d{2}-\d{2})/);
      const date = dateMatch ? dateMatch[1] : title.replace(/[^\d-]/g, "");
      return { date, title, itemIndex: idx };
    }).filter((d: { date: string; title: string; itemIndex: number }) => /^\d{4}-\d{2}-\d{2}$/.test(d.date));
  } catch { return []; }
}
