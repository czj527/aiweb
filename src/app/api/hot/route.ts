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
 */
export async function GET(request: NextRequest) {
  const hours = parseInt(request.nextUrl.searchParams.get("hours") || "24", 10);
  const limit = parseInt(request.nextUrl.searchParams.get("limit") || "10", 10);

  try {
    // 取多一些再截取，确保有足够数据
    const news = await getRecentNews(hours, Math.max(limit, 50));

    const hotNews = news.slice(0, limit).map(transformNewsRow);

    return NextResponse.json({
      success: true,
      data: {
        hours,
        totalCount: news.length,
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
