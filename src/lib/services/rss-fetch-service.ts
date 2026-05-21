// eslint-disable-next-line @typescript-eslint/no-require-imports
const Parser = require("rss-parser");

// ============================================================
// 橘鸦AI早报 RSS 采集服务（单一信息源）
// ============================================================

/** 橘鸦分类 → 内部分类映射（对齐橘鸦实际使用的分类名） */
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

    // 转为列表格式
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

    // 只取最新的一条
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

    // 从标题中提取期号，如 "AI 早报 2026-05-19 #95" -> 95
    const issueMatch = title.match(/#(\d+)/);
    const issueNumber = issueMatch ? parseInt(issueMatch[1], 10) : 0;

    // 从日期中提取日期，格式为 YYYY-MM-DD
    const dateMatch = pubDate.match(/(\d{4}-\d{2}-\d{2})/);
    const date = dateMatch ? dateMatch[1] : new Date().toISOString().slice(0, 10);

    // 清理HTML内容，保留原始格式
    const cleanContent = contentEncoded
      .replace(/<!\[CDATA\[/g, "")
      .replace(/\]\]>/g, "")
      .trim();

    console.log(`[Juya] Fetched daily report: ${title}`);
    return {
      title,
      date,
      content: cleanContent,
      issueNumber,
    };
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : "Unknown error";
    console.warn(`[Juya] RSS fetch failed: ${errMsg}`);
    return null;
  }
}
