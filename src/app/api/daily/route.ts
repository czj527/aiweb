import { NextRequest, NextResponse } from "next/server";
import {
  getLatestDailyReport,
  getDailyReport,
  getDailyReportList,
} from "@/lib/services/db-service";

/**
 * 将 Supabase snake_case 新闻行转换为前端 camelCase 格式
 */
function transformNewsRow(row: Record<string, unknown>) {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    aiDetail: (row as Record<string, unknown>).ai_detail ?? null,
    source: row.source_name,
    sourceUrl: row.source_url,
    category: row.category,
    importanceScore: row.importance_score,
    importanceLevel: row.importance_level,
    keywords: row.keywords,
    publishedAt: row.published_at,
    relatedIds: (row as Record<string, unknown>).related_ids ?? [],
  };
}

/**
 * GET /api/daily
 * 获取日报数据
 *
 * 查询参数：
 * - date: 指定日期 (YYYY-MM-DD)，不传则返回最新
 * - list: 传 "true" 获取往期日报列表
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const date = searchParams.get("date");
  const list = searchParams.get("list");
  const top = searchParams.get("top") || searchParams.get("topOnly");

  try {
    // 获取往期列表
    if (list === "true") {
      const reports = await getDailyReportList(7);
      // 转换字段名
      const transformed = (reports || []).map(
        (r: Record<string, unknown>) => ({
          id: r.id,
          reportDate: r.report_date,
          overview: r.overview,
          newsCount: r.news_count,
        })
      );
      return NextResponse.json({ success: true, data: transformed }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
    }

    // 获取指定日期或最新日报
    let report;
    if (date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return NextResponse.json(
          { error: "日期格式错误，请使用 YYYY-MM-DD" },
          { status: 400 }
        );
      }
      report = await getDailyReport(date);
    } else {
      report = await getLatestDailyReport();
    }

    if (!report) {
      return NextResponse.json(
        { error: "未找到日报数据", hint: "请先调用 POST /api/daily/generate 生成日报" },
        { status: 404 }
      );
    }

    const r = report as Record<string, unknown>;
    const newsRows = ((r.news || []) as Record<string, unknown>[])
      .sort((a, b) => ((b.importance_score as number) ?? 0) - ((a.importance_score as number) ?? 0));

    const totalNewsCount = newsRows.length;
    const limitedNews = top ? newsRows.slice(0, parseInt(top, 10) || 10) : newsRows;

    const transformed = {
      id: r.id,
      reportDate: r.report_date,
      overview: r.overview,
      hotTopics: r.hot_topics,
      newsCount: r.news_count,
      totalNewsCount,
      news: limitedNews.map(transformNewsRow),
      createdAt: r.created_at,
    };

    return NextResponse.json({ success: true, data: transformed }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "Unknown error";
    console.error("[Daily GET] Error:", errorMessage);
    return NextResponse.json(
      { error: "获取日报失败", detail: errorMessage },
      { status: 500 }
    );
  }
}
