import { NextRequest, NextResponse } from "next/server";
import { getRecentNews, type NewsItemRow } from "@/lib/services/db-service";

/**
 * 将 Supabase snake_case 新闻行转换为前端 camelCase 格式
 */
function transformNewsRow(row: NewsItemRow) {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    aiDetail: row.ai_detail ?? null,
    source: row.source,
    sourceUrl: row.source_url,
    category: row.category,
    importanceScore: row.importance_score,
    importanceLevel: row.importance_level,
    keywords: row.keywords,
    publishedAt: row.published_at,
  };
}

/**
 * GET /api/hot
 * 获取最近 N 小时的热点新闻（按重要性排序）
 *
 * 查询参数：
 * - hours: 往前推多少小时，默认 24
 * - limit: 返回数量，默认 10
 * - grouped: 是否按分类分组返回，默认 false
 */
export async function GET(request: NextRequest) {
  const hours = parseInt(request.nextUrl.searchParams.get("hours") || "24", 10);
  const limit = parseInt(request.nextUrl.searchParams.get("limit") || "10", 10);
  const grouped = request.nextUrl.searchParams.get("grouped") === "true";

  try {
    // 取多一些再截取，确保有足够数据
    const allNews = await getRecentNews(hours, Math.max(limit, 100));

    if (grouped) {
      // 按分类分组，每个分类最多5条，按重要性排序
      const categoryMap: Record<string, NewsItemRow[]> = {};
      for (const item of allNews) {
        const cat = item.category || "industry";
        if (!categoryMap[cat]) categoryMap[cat] = [];
        if (categoryMap[cat].length < 5) {
          categoryMap[cat].push(item);
        }
      }

      // 转换格式
      const byCategory: Record<string, ReturnType<typeof transformNewsRow>[]> = {};
      for (const [cat, items] of Object.entries(categoryMap)) {
        byCategory[cat] = items.map(transformNewsRow);
      }

      // Top 3 overall（跨分类取最重要的）
      const topNews = allNews.slice(0, 3).map(transformNewsRow);

      return NextResponse.json({
        success: true,
        data: {
          hours,
          totalCount: allNews.length,
          byCategory,
          topNews,
        },
      });
    }

    // 非分组模式：保持原有行为
    const hotNews = allNews.slice(0, limit).map(transformNewsRow);

    return NextResponse.json({
      success: true,
      data: {
        hours,
        totalCount: allNews.length,
        news: hotNews,
      },
    });
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "Unknown error";
    console.error("[Hot] Error:", errorMessage);
    return NextResponse.json(
      { error: "获取热点资讯失败", detail: errorMessage },
      { status: 500 }
    );
  }
}
