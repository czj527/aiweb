import { NextRequest, NextResponse } from "next/server";
import { getNewsById, getRelatedNews } from "@/lib/services/db-service";

/**
 * 将 Supabase snake_case 新闻行转换为前端 camelCase 格式
 */
function transformNewsRow(row: Record<string, unknown>) {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    aiDetail: row.ai_detail ?? null,
    source: row.source_name,
    sourceUrl: row.source_url,
    category: row.category,
    importanceScore: row.importance_score,
    importanceLevel: row.importance_level,
    keywords: row.keywords,
    publishedAt: row.published_at,
    relatedIds: (row.related_ids ?? []) as string[],
  };
}

/**
 * GET /api/news
 * 获取新闻详情和相关推荐
 *
 * 查询参数：
 * - id: 新闻ID（必填）
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json(
      { error: "缺少 id 参数" },
      { status: 400 }
    );
  }

  try {
    const news = await getNewsById(id);

    if (!news) {
      return NextResponse.json(
        { error: "新闻不存在" },
        { status: 404 }
      );
    }

    const newsRow = news as Record<string, unknown>;

    // 获取相关推荐
    const relatedRows = await getRelatedNews(
      newsRow.category as string,
      id,
      3
    );
    const related = (relatedRows || []).map((r: Record<string, unknown>) =>
      transformNewsRow(r)
    );
    const relatedIds: string[] = [];
    for (const r of related) {
      if (r && typeof r === "object" && "id" in r) {
        relatedIds.push(r.id as string);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        ...transformNewsRow(newsRow),
        relatedIds,
        multiSourceViews: [], // TODO: 实现多源视角
      },
    });
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "Unknown error";
    console.error("[News GET] Error:", errorMessage);
    return NextResponse.json(
      { error: "获取新闻失败", detail: errorMessage },
      { status: 500 }
    );
  }
}
