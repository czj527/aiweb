import { NextRequest, NextResponse } from "next/server";
import {
  getLatestWeeklyReport,
  getWeeklyReportList,
} from "@/lib/services/db-service";

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
    relatedIds: row.related_ids ?? [],
  };
}

/**
 * GET /api/weekly
 * 获取周报数据
 *
 * 查询参数：
 * - list: 传 "true" 获取往期周报列表
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const list = searchParams.get("list");

  try {
    if (list === "true") {
      const reports = await getWeeklyReportList(4);
      const transformed = (reports || []).map(
        (r: Record<string, unknown>) => ({
          id: r.id,
          weekStart: r.week_start_date,
          weekEnd: r.week_end_date,
          weekNumber: r.week_number,
          overview: r.overview,
          newsCount: r.news_count,
        })
      );
      return NextResponse.json({ success: true, data: transformed });
    }

    const report = await getLatestWeeklyReport();

    if (!report) {
      return NextResponse.json(
        { error: "未找到周报数据", hint: "请先调用 POST /api/weekly/generate 生成周报" },
        { status: 404 }
      );
    }

    const r = report as Record<string, unknown>;
    const newsRows = (r.news || []) as Record<string, unknown>[];

    const transformed = {
      id: r.id,
      weekNumber: r.week_number,
      weekStart: r.week_start_date,
      weekEnd: r.week_end_date,
      overview: r.overview,
      techTrends: r.tech_trends,
      industryTrends: r.industry_trends,
      investmentHighlights: r.investment_highlights,
      trends: [r.tech_trends, r.industry_trends, r.investment_highlights].filter(
        Boolean
      ) as string[],
      hotTopics: r.hot_topics,
      newsCount: r.news_count,
      news: newsRows.map(transformNewsRow),
      createdAt: r.created_at,
    };

    return NextResponse.json({ success: true, data: transformed });
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "Unknown error";
    console.error("[Weekly GET] Error:", errorMessage);
    return NextResponse.json(
      { error: "获取周报失败", detail: errorMessage },
      { status: 500 }
    );
  }
}
