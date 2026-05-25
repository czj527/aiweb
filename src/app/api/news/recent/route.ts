import { NextRequest, NextResponse } from "next/server";
import { getNewsByDateRange } from "@/lib/services/db-service";

/**
 * GET /api/news/recent
 * 获取最近 N 天的资讯，按日期和分类分组
 *
 * 查询参数：
 * - days: 天数 (默认 7)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get("days") || "7", 10);
    const validDays = Math.min(Math.max(days, 1), 30);

    // 计算日期范围
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - validDays + 1);

    const startStr = startDate.toISOString().split("T")[0];
    const endStr = endDate.toISOString().split("T")[0];

    // 从数据库获取新闻
    const newsItems = await getNewsByDateRange(startStr, endStr);

    // 按日期分组
    const byDate = new Map<
      string,
      Map<
        string,
        Array<{
          id: string;
          title: string;
          source: string;
          sourceUrl: string;
          summary: string;
          publishedAt: string;
        }>
      >
    >();

    for (const item of newsItems) {
      const dateKey = item.published_at.split("T")[0];
      if (!byDate.has(dateKey)) {
        byDate.set(dateKey, new Map());
      }
      const catMap = byDate.get(dateKey)!;
      const cat = item.category || "要闻";
      if (!catMap.has(cat)) {
        catMap.set(cat, []);
      }
      catMap.get(cat)!.push({
        id: item.id,
        title: item.title,
        source: item.source_name,
        sourceUrl: item.source_url,
        summary: item.summary || "",
        publishedAt: item.published_at,
      });
    }

    // 构建响应数据结构
    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

    const daysData = [];
    for (let i = 0; i < validDays; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];

      const catMap = byDate.get(dateStr);
      if (!catMap || catMap.size === 0) continue;

      // 分类按资讯数量降序排列
      const categories = Array.from(catMap.entries())
        .map(([category, items]) => ({
          category,
          count: items.length,
          items,
        }))
        .sort((a, b) => b.count - a.count);

      // 日期标签
      let dateLabel: string;
      if (dateStr === today) {
        dateLabel = `今天 · ${d.getMonth() + 1}月${d.getDate()}日`;
      } else if (dateStr === yesterday) {
        dateLabel = `昨天 · ${d.getMonth() + 1}月${d.getDate()}日`;
      } else {
        const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
        dateLabel = `${d.getMonth() + 1}月${d.getDate()}日 · ${weekdays[d.getDay()]}`;
      }

      daysData.push({
        date: dateStr,
        dateLabel,
        categories,
        totalCount: categories.reduce((sum, c) => sum + c.count, 0),
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        days: daysData,
        fetchedAt: new Date().toISOString(),
      },
    });
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "Unknown error";
    console.error("[NewsRecent] Error:", errorMessage);
    return NextResponse.json(
      { error: "获取近期资讯失败", detail: errorMessage },
      { status: 500 }
    );
  }
}
