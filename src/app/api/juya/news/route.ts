import { NextResponse } from "next/server";

const JUYU_RSS_URL = "https://imjuya.github.io/juya-ai-daily/rss.xml";

/**
 * 解析RSS XML为结构化数据
 */
function parseRSS(xmlString: string) {
  const items: Array<{
    title: string;
    url: string;
    quote: string;
    snippet: string;
    category: string;
  }> = [];

  // 解析 <item> 标签
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xmlString)) !== null) {
    const itemContent = match[1];

    // 提取标题
    const titleMatch = /<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i.exec(itemContent);
    const title = titleMatch ? titleMatch[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim() : "";

    // 提取链接
    const linkMatch = /<link[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i.exec(itemContent);
    let url = linkMatch ? linkMatch[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim() : "";

    // 有些RSS link在<guid>中
    if (!url) {
      const guidMatch = /<guid[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/guid>/i.exec(itemContent);
      url = guidMatch ? guidMatch[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim() : "";
    }

    // 提取描述/摘要
    const descMatch = /<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i.exec(itemContent);
    let snippet = descMatch ? descMatch[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim() : "";

    // 清理HTML标签
    snippet = snippet.replace(/<[^>]+>/g, "").trim();
    // 截取前200字符
    if (snippet.length > 200) {
      snippet = snippet.slice(0, 200) + "...";
    }

    // 提取分类
    const catMatch = /<category[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/category>/i.exec(itemContent);
    const category = catMatch ? catMatch[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim() : "要闻";

    // 提取引用/金句 (如果存在)
    const quoteMatch = /<quote[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/quote>/i.exec(itemContent);
    const quote = quoteMatch ? quoteMatch[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim() : "";

    if (title && url) {
      items.push({ title, url, quote, snippet, category });
    }
  }

  return items;
}

/**
 * 将橘鸦分类映射到8分类
 */
function mapCategory(cat: string): string {
  const mapping: Record<string, string> = {
    "模型": "模型发布",
    "大模型": "模型发布",
    "开源": "开发生态",
    "开发者": "开发生态",
    "产品": "产品应用",
    "技术": "技术与洞察",
    "学术": "技术与洞察",
    "行业": "行业动态",
    "企业": "行业动态",
    "政策": "政策与治理",
    "监管": "政策与治理",
    "前瞻": "前瞻与传闻",
    "传闻": "前瞻与传闻",
  };

  for (const [key, value] of Object.entries(mapping)) {
    if (cat.includes(key)) return value;
  }

  return "要闻"; // 默认归入要闻
}

/**
 * GET /api/juya/news
 * 获取橘鸦AI早报RSS数据（作为Supabase fallback）
 */
export async function GET() {
  try {
    const response = await fetch(JUYU_RSS_URL, {
      next: { revalidate: 300 }, // 5分钟缓存
    });

    if (!response.ok) {
      throw new Error(`RSS fetch failed: ${response.status}`);
    }

    const xml = await response.text();
    const items = parseRSS(xml);

    // 按分类分组
    const categoryMap = new Map<string, typeof items>();
    for (const item of items) {
      const cat = mapCategory(item.category);
      if (!categoryMap.has(cat)) {
        categoryMap.set(cat, []);
      }
      categoryMap.get(cat)!.push(item);
    }

    // 固定的8分类顺序
    const JUYU_CATEGORIES = [
      "要闻",
      "模型发布",
      "开发生态",
      "产品应用",
      "技术与洞察",
      "行业动态",
      "政策与治理",
      "前瞻与传闻",
    ];

    const categories = JUYU_CATEGORIES.map((cat) => ({
      category: cat,
      items: categoryMap.get(cat) || [],
    })).filter((c) => c.items.length > 0);

    return NextResponse.json({
      success: true,
      data: {
        categories,
        fetchedAt: new Date().toISOString(),
      },
    });
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "Unknown error";
    console.error("[Juya/News] Error:", errorMessage);

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
