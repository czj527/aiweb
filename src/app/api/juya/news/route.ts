import { NextRequest, NextResponse } from "next/server";
import { fetchJuyaFeed } from "@/lib/services/rss-fetch-service";

/**
 * GET /api/juya/news
 * 获取橘鸦资讯列表（用于首页展示）
 * 
 * 直接从橘鸦RSS获取，不经过数据库
 */
export async function GET(request: NextRequest) {
  try {
    const results = await fetchJuyaFeed();

    // 按分类分组
    const byCategory: Record<string, typeof results> = {};
    for (const item of results) {
      const cat = item._juyaCategory || "industry";
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(item);
    }

    // 分类顺序
    const categoryOrder = ["model", "agent", "opensource", "product", "research", "industry", "policy", "rumor"];

    // 构建响应
    const categories = categoryOrder
      .filter((cat) => byCategory[cat]?.length > 0)
      .map((cat) => ({
        category: cat,
        items: byCategory[cat].map((item) => ({
          title: item.title,
          url: item.url,
          quote: item._juyaQuote || item.snippet,
          snippet: item.snippet,
        })),
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
