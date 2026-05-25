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

/**
 * 从橘鸦RSS的content:encoded HTML中解析出单条新闻
 *
 * 橘鸦RSS格式（每天一条汇总）：
 * - <h3>分类名</h3> + <ul><li>标题 <a href="url">↗</a> <code>#N</code></li></ul>
 * - <hr> 分隔各条详情
 * - <h2><a href="url">标题</a> <code>#N</code></h2>  （带链接）
 * - <h2>标题 <code>#N</code></h2>                    （无链接，如#4、#19）
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

  // --- 第一步：从概览区提取分类映射和URL映射 ---
  const categoryByTitle = new Map<string, string>();
  const urlByTitle = new Map<string, string>();
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
        // 概览li格式：<li>标题 <a href="url">↗</a> <code>#N</code></li>
        // 或：<li>标题 <code>#N</code></li>（无链接）
        const itemWithLink = line.match(/<li>(.*?)<a href="(.*?)".*?<code>#(\d+)<\/code>/);
        const itemWithoutLink = line.match(/<li>(.*?)<code>#(\d+)<\/code>/);

        if (itemWithLink) {
          const title = itemWithLink[1].trim();
          categoryByTitle.set(title, currentCategory);
          urlByTitle.set(title, itemWithLink[2].trim());
        } else if (itemWithoutLink) {
          const title = itemWithoutLink[1].trim();
          categoryByTitle.set(title, currentCategory);
          // 无链接的新闻，URL留空
        }
      }
    }
  }

  // --- 第二步：按 <hr> 分割详情区，解析每条新闻 ---
  const sections = clean.split(/<hr\s*\/?>/);

  for (const section of sections) {
    let url = "";
    let title = "";
    let order = 0;

    // 格式1：<h2><a href="url">标题</a> <code>#N</code></h2>（带链接）
    const h2WithLink = section.match(/<h2><a href="(.*?)">(.*?)<\/a>\s*<code>#(\d+)<\/code><\/h2>/);
    if (h2WithLink) {
      url = h2WithLink[1].trim();
      title = h2WithLink[2].trim();
      order = parseInt(h2WithLink[3], 10);
    } else {
      // 格式2：<h2>标题 <code>#N</code></h2>（无链接）
      const h2NoLink = section.match(/<h2>(.*?)<code>#(\d+)<\/code><\/h2>/);
      if (!h2NoLink) continue;
      title = h2NoLink[1].trim();
      order = parseInt(h2NoLink[2], 10);
      // 尝试从概览区获取URL
      url = urlByTitle.get(title) || "";
    }

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

    // 分类：优先从概览区映射
    const mappedCategory = categoryByTitle.get(title) || "";

    articles.push({ title, url, category: mappedCategory, quote, fullText, order, pubDate });
  }

  return articles;
}

/**
 * 获取橘鸦AI早报RSS并解析为单条新闻列表
 * 用于首页展示
 */
export async function fetchJuyaFeed(): Promise<Array<{
  title: string;
  url: string;
  snippet: string;
  source?: string;
  date?: string;
  _juyaCategory?: string;
  _juyaQuote?: string;
  _juyaOrder?: number;
}>> {
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
      (latestItem as Record<string, unknown>)["contentEncoded"] as string ||
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

    return articles.map((a) => ({
      title: a.title,
      snippet: a.fullText || a.quote,
      url: a.url,
      source: "橘鸦AI早报",
      date: pubDate,
      _juyaCategory: a.category,
      _juyaQuote: a.quote,
      _juyaOrder: a.order,
    }));
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : "Unknown error";
    console.warn(`[Juya] RSS fetch failed: ${errMsg}`);
    return [];
  }
}

/**
 * 获取橘鸦AI早报的完整内容（用于日报展示）
 * 返回完整的HTML内容，保留原始格式
 */
export async function fetchJuyaDailyReport(): Promise<{
  title: string;
  date: string;
  content: string;
  issueNumber: number;
} | null> {
  const parser = createParser();

  try {
    const parsed = await parser.parseURL(JUYA_RSS_URL);
    if (!parsed.items || parsed.items.length === 0) {
      console.log("[Juya] RSS: 0 items");
      return null;
    }

    const latestItem = parsed.items[0];
    const contentEncoded =
      (latestItem as Record<string, unknown>)["contentEncoded"] as string ||
      (latestItem as Record<string, unknown>)["content:encoded"] as string ||
      latestItem.content ||
      "";
    const title = latestItem.title || "AI 早报";
    const pubDate = latestItem.isoDate || latestItem.pubDate || new Date().toISOString();

    if (!contentEncoded) {
      console.warn("[Juya] No content:encoded found");
      return null;
    }

    const issueMatch = title.match(/#(\d+)/);
    const issueNumber = issueMatch ? parseInt(issueMatch[1], 10) : 0;

    const dateMatch = pubDate.match(/(\d{4}-\d{2}-\d{2})/);
    const date = dateMatch ? dateMatch[1] : new Date().toISOString().slice(0, 10);

    const cleanContent = contentEncoded
      .replace(/<!\[CDATA\[/g, "")
      .replace(/\]\]>/g, "")
      .trim();

    console.log(`[Juya] Fetched daily report: ${title}`);
    return { title, date, content: cleanContent, issueNumber };
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : "Unknown error";
    console.warn(`[Juya] RSS fetch failed: ${errMsg}`);
    return null;
  }
}
