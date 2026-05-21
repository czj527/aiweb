import { NextRequest, NextResponse } from "next/server";
import { fetchJuyaFeed, JUYA_CATEGORY_MAP } from "@/lib/services/rss-fetch-service";

/**
 * GET /api/juya/news
 * 获取橘鸦资讯列表（用于首页展示）
 * 
 * 直接从橘鸦RSS获取，不经过数据库
 */
export async function GET(request: NextRequest) {
  try {
    const results = await fetchJuyaFeed();

    // 按分类分组（将橘鸦原始分类名映射为内部key）
    const byCategory: Record<string, Array<{ title: string; url: string; quote: string; snippet: string }>> = {};
    for (const item of results) {
      // 映射分类：橘鸦分类名 → 内部key
      const rawCat = item._juyaCategory || "";
      const cat = JUYA_CATEGORY_MAP[rawCat] || rawCat || "industry";
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push({
        title: item.title,
        url: item.url,
        quote: item._juyaQuote || "",
        snippet: item.snippet,
      });
    }

    // 分类顺序
    const categoryOrder = ["model", "agent", "opensource", "product", "research", "industry", "policy", "rumor"];

    // 构建响应
    const categories = categoryOrder
      .filter((cat) => byCategory[cat]?.length > 0)
      .map((cat) => ({
        category: cat,
        items: byCategory[cat],
      }));

    return NextResponse.json({
      success: true,
      data: {
        totalCount: results.length,
        categories,
        fetchedAt: new Date().toISOString(),
      },
    });
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "Unknown error";
    console.error("[JuyaNews] Error:", errorMessage);
    return NextResponse.json(
      { error: "获取橘鸦资讯失败", detail: errorMessage },
      { status: 500 }
    );
  }
}
