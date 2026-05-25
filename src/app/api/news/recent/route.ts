import { NextRequest, NextResponse } from "next/server";
import { getNewsByDateRange } from "@/lib/services/db-service";

/** 获取上海时区的日期字符串 YYYY-MM-DD */
function toShanghaiDate(date: Date): string {
  return date.toLocaleString("sv-SE", { timeZone: "Asia/Shanghai" }).split(" ")[0];
}

/**
 * GET /api/news/recent
 * 获取最近 N 天的资讯，按日期和分类分组（使用上海时区）
 *
 * 查询参数：
 * - days: 天数 (默认 7)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get("days") || "7", 10);
    const validDays = Math.min(Math.max(days, 1), 30);

    // 使用上海时区计算日期范围
    const now = new Date();
    const todayStr = toShanghaiDate(now);
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - validDays + 1);
    const startStr = toShanghaiDate(startDate);

    // 从数据库获取新闻（查询范围用上海时区日期）
    const newsItems = await getNewsByDateRange(startStr, todayStr);

    // 按上海时区日期分组
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
      // 将 UTC published_at 转为上海时区日期
      const utcDate = new Date(item.published_at);
      const dateKey = toShanghaiDate(utcDate);
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
    const yesterdayStr = toShanghaiDate(new Date(Date.now() - 86400000));

    const daysData = [];
    for (let i = 0; i < validDays; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = toShanghaiDate(d);

      const catMap = byDate.get(dateStr);
      if (!catMap || catMap.size === 0) continue;

      // 分类排序：先按JUYA_CATEGORIES顺序，同序内按数量降序
      const JUYA_ORDER = ["要闻", "模型发布", "开发生态", "产品应用", "技术与洞察", "行业动态", "政策与治理", "前瞻与传闻"];
      const categories = Array.from(catMap.entries())
        .map(([category, items]) => ({
          category,
          count: items.length,
          items,
        }))
        .sort((a, b) => {
          const idxA = JUYA_ORDER.indexOf(a.category);
          const idxB = JUYA_ORDER.indexOf(b.category);
          // 已知分类按橘鸦顺序排，未知分类放最后
          const orderA = idxA === -1 ? 999 : idxA;
          const orderB = idxB === -1 ? 999 : idxB;
          if (orderA !== orderB) return orderA - orderB;
          return b.count - a.count;
        });

      // 日期标签
      let dateLabel: string;
      const monthDay = `${d.getMonth() + 1}月${d.getDate()}日`;
      if (dateStr === todayStr) {
        dateLabel = `今天 · ${monthDay}`;
      } else if (dateStr === yesterdayStr) {
        dateLabel = `昨天 · ${monthDay}`;
      } else {
        const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
        dateLabel = `${monthDay} · ${weekdays[d.getDay()]}`;
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
