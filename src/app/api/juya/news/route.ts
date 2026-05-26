import { NextRequest, NextResponse } from "next/server";
import { fetchJuyaFeed, JUYA_CATEGORIES } from "@/lib/services/rss-fetch-service";

/**
 * GET /api/juya/news
 * 获取橘鸦资讯列表（用于首页展示）
 * 
 * 直接从橘鸦RSS获取，不经过数据库
 * 分类使用橘鸦原始分类名
 */
export async function GET(request: NextRequest) {
  try {
    const results = await fetchJuyaFeed();

    // 按橘鸦原始分类名分组
    const byCategory: Record<string, Array<{ title: string; url: string; quote: string; snippet: string; order: number }>> = {};
    for (const item of results) {
      const cat = item._juyaCategory || "要闻";
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push({
        title: item.title,
        url: item.url,
        quote: item._juyaQuote || "",
        snippet: item.snippet,
        order: item._juyaOrder || 0,
      });
    }

    // 按橘鸦分类顺序排列
    const categories: Array<{ category: string; items: Array<{ title: string; url: string; quote: string; snippet: string; order: number }> }> = [];
    const coveredCats = new Set<string>();

    for (const cat of JUYA_CATEGORIES) {
      if (byCategory[cat]?.length > 0) {
        categories.push({ category: cat, items: byCategory[cat] });
        coveredCats.add(cat);
      }
    }

    // 未被 JUYA_CATEGORIES 覆盖的分类也追加到末尾
    for (const cat of Object.keys(byCategory)) {
      if (!coveredCats.has(cat)) {
        categories.push({ category: cat, items: byCategory[cat] });
      }
    }

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
