import { NextRequest, NextResponse } from "next/server";
import { getNewsByDateRange, type NewsItemRow } from "@/lib/services/db-service";

// 橘鸦8分类
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

/**
 * 将 Supabase snake_case 新闻行转换为前端 camelCase 格式
 */
function transformNewsRow(row: NewsItemRow) {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary || "",
    source: row.source_name || row.source,
    sourceUrl: row.source_url,
    category: row.category,
    importanceScore: row.importance_score,
    importanceLevel: row.importance_level,
    keywords: row.keywords || [],
    publishedAt: row.published_at,
  };
}

/**
 * 获取日期标签
 */
function getDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const dateOnly = dateStr.slice(0, 10);
  const todayOnly = today.toISOString().slice(0, 10);
  const yesterdayOnly = yesterday.toISOString().slice(0, 10);

  if (dateOnly === todayOnly) {
    return `今天 · ${date.toLocaleDateString("zh-CN", { month: "long", day: "numeric" })}`;
  } else if (dateOnly === yesterdayOnly) {
    return `昨天 · ${date.toLocaleDateString("zh-CN", { month: "long", day: "numeric" })}`;
  } else {
    return date.toLocaleDateString("zh-CN", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }
}

/**
 * 获取过去N天的日期列表
 */
function getPastDays(days: number): string[] {
  const dates: string[] = [];
  const today = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

/**
 * GET /api/news/recent
 * 获取最近N天的新闻，按日期分组
 *
 * 查询参数：
 * - days: 天数，默认 7
 */
export async function GET(request: NextRequest) {
  const days = parseInt(request.nextUrl.searchParams.get("days") || "7", 10);
  const clampedDays = Math.min(Math.max(days, 1), 30); // 限制1-30天

  try {
    const pastDays = getPastDays(clampedDays);
    const startDate = pastDays[pastDays.length - 1];
    const endDate = pastDays[0];

    // 从数据库获取新闻
    const news = await getNewsByDateRange(startDate, endDate);

    // 按日期分组
    const daysData = pastDays.map((date) => {
      const dayNews = news.filter((n) => n.published_at.slice(0, 10) === date);

      // 按分类聚合
      const categoryMap = new Map<string, NewsItemRow[]>();
      for (const n of dayNews) {
        const cat = JUYU_CATEGORIES.includes(n.category) ? n.category : "要闻";
        if (!categoryMap.has(cat)) {
          categoryMap.set(cat, []);
        }
        categoryMap.get(cat)!.push(n);
      }

      const categories = JUYU_CATEGORIES.map((cat) => ({
        category: cat,
        count: categoryMap.get(cat)?.length || 0,
        items: (categoryMap.get(cat) || []).map(transformNewsRow),
      })).filter((c) => c.count > 0);

      const totalCount = dayNews.length;

      return {
        date,
        dateLabel: getDateLabel(date),
        categories,
        totalCount,
      };
    }).filter((d) => d.totalCount > 0);

    return NextResponse.json({
      success: true,
      data: {
        days: daysData,
        fetchedAt: new Date().toISOString(),
      },
    });
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "Unknown error";
    console.error("[News/Recent] Error:", errorMessage);

    // 返回降级标记，前端据此走 RSS fallback
    return NextResponse.json({
      success: false,
      fallback: true,
      error: errorMessage,
    });
  }
}
