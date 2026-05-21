// eslint-disable-next-line @typescript-eslint/no-require-imports
const Parser = require("rss-parser");

// ============================================================
// 橘鸦AI早报 RSS 采集服务
// ============================================================

/** 橘鸦分类 → 内部分类映射 */
export const JUYA_CATEGORY_MAP: Record<string, string> = {
  "模型": "model",
  "开源": "opensource",
  "产品": "product",
  "政策": "policy",
  "技术": "research",
  "Agent": "agent",
  "行业": "industry",
  "传闻": "rumor",
};

/** 橘鸦RSS源配置 */
const JUYA_FEED_URL = "https://juya.fun/feed";

/**
 * 解析橘鸦日报HTML，提取结构化数据
 */
export function parseJuyaHTML(html: string): {
  title: string;
  date: string;
  overview: string;
  articles: Array<{
    title: string;
    category: string;
    quote: string;
    content: string;
    url: string;
  }>;
} {
  // 提取标题
  const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
  const title = titleMatch ? titleMatch[1].trim() : "";

  // 提取日期
  const dateMatch = html.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  const date = dateMatch
    ? `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}`
    : new Date().toISOString().split("T")[0];

  // 提取文章列表
  const articles: Array<{
    title: string;
    category: string;
    quote: string;
    content: string;
    url: string;
  }> = [];

  // 按 h2/h3 分割内容块
  const sectionPattern = /<h[23][^>]*>([^<]+)<\/h[23]>([\s\S]*?)(?=<h[23]|$)/g;
  let match;

  while ((match = sectionPattern.exec(html)) !== null) {
    const sectionTitle = match[1].trim();
    const sectionContent = match[2];

    // 跳过非文章标题（不包含标题格式的）
    if (!sectionTitle || sectionTitle.length < 5) continue;

    // 判断分类
    let category = "行业";
    for (const [cat, mapped] of Object.entries(JUYA_CATEGORY_MAP)) {
      if (sectionTitle.includes(cat)) {
        category = cat;
        break;
      }
    }

    // 提取blockquote作为quote
    const quoteMatch = sectionContent.match(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/);
    const quote = quoteMatch
      ? quoteMatch[1].replace(/<[^>]+>/g, "").trim()
      : "";

    // 提取正文（去掉blockquote和h标签）
    const content = sectionContent
      .replace(/<blockquote[^>]*>[\s\S]*?<\/blockquote>/g, "")
      .replace(/<h[23][^>]*>.*?<\/h[23]>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // 提取链接
    const linkMatch = sectionContent.match(/href="([^"]+)"/);
    const url = linkMatch ? linkMatch[1] : "";

    if (sectionTitle.length > 5) {
      articles.push({
        title: sectionTitle,
        category,
        quote,
        content,
        url,
      });
    }
  }

  // 提取overview（第一段大段文字）
  const overviewMatch = html.match(/<p[^>]*>([\s\S]{200,})<\/p>/);
  const overview = overviewMatch ? overviewMatch[1].replace(/<[^>]+>/g, "").trim() : "";

  return { title, date, overview, articles };
}

/**
 * 获取橘鸦最新一期日报的完整HTML内容
 */
export async function fetchJuyaDailyReport(): Promise<string> {
  try {
    const parser = new Parser({
      customFields: {
        item: [],
      },
    });

    const feed = await parser.parseURL(JUYA_FEED_URL);

    if (!feed.items || feed.items.length === 0) {
      throw new Error("橘鸦RSS为空");
    }

    // 获取最新一期
    const latestItem = feed.items[0];

    // 如果有完整内容，直接返回
    if (latestItem.content) {
      return latestItem.content;
    }

    // 否则尝试从 enclosures 或其他字段获取
    if (latestItem.enclosure?.url) {
      const response = await fetch(latestItem.enclosure.url);
      return await response.text();
    }

    // 返回摘要作为后备
    return latestItem.content || latestItem.summary || "";
  } catch (error) {
    console.error("[Juya] Failed to fetch daily report:", error);
    throw error;
  }
}

/**
 * 获取橘鸦RSS并解析为结构化数据
 * 返回简化格式用于列表展示
 */
export async function fetchJuyaFeed(): Promise<Array<{
  title: string;
  url: string;
  snippet: string;
  date?: string;
  _juyaCategory?: string;
  _juyaQuote?: string;
}>> {
  try {
    // 获取完整HTML日报
    const html = await fetchJuyaDailyReport();

    // 解析HTML
    const parsed = parseJuyaHTML(html);

    // 转换为列表格式
    return parsed.articles.map((article) => ({
      title: article.title,
      url: article.url || `https://juya.fun/daily/${parsed.date}`,
      snippet: article.quote || article.content.slice(0, 200),
      date: parsed.date,
      _juyaCategory: JUYA_CATEGORY_MAP[article.category] || article.category,
      _juyaQuote: article.quote,
    }));
  } catch (error) {
    console.error("[Juya] Failed to fetch feed:", error);
    return [];
  }
}
