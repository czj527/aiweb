import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/admin-auth";
import {
  fetchJuyaFeed,
  fetchJuyaDailyReport,
  getAvailableDates,
} from "@/lib/services/rss-fetch-service";
import {
  deduplicateResults,
  convertJuyaResults,
} from "@/lib/services/processor";
import {
  upsertNewsItems,
  createDailyReport,
  getDailyReportByDate,
} from "@/lib/services/db-service";

/**
 * POST /api/admin/backfill
 * 从橘鸦RSS补充历史数据（最近N天）
 * 
 * body: { days: number } (默认5)
 * 需要 admin cookie 认证
 */
export async function POST(request: NextRequest) {
  const token = request.cookies.get("admin_token")?.value;
  if (!token || !verifyAdminToken(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const days = Math.min(body.days || 5, 10);

  try {
    const availableDates = await getAvailableDates();
    const toProcess = availableDates.slice(0, days);

    const results: Array<{ date: string; newsCount: number; reportCreated: boolean; skipped: boolean }> = [];

    for (const { date, itemIndex } of toProcess) {
      let existing: { id: string } | null = null;
      try {
        existing = await getDailyReportByDate(date);
      } catch {
        // Supabase不可用，继续
      }

      if (existing) {
        results.push({ date, newsCount: 0, reportCreated: false, skipped: true });
        continue;
      }

      const juyaResults = await fetchJuyaFeed(itemIndex);
      const dedupedResults = deduplicateResults(juyaResults);
      const processedNews = convertJuyaResults(dedupedResults);

      let newsCount = 0;
      try {
        if (processedNews.length > 0) {
          await upsertNewsItems(processedNews);
          newsCount = processedNews.length;
        }
      } catch (e) {
        console.warn(`[Backfill] Cannot save news for ${date}:`, e);
      }

      let reportCreated = false;
      try {
        const juyaReport = await fetchJuyaDailyReport(itemIndex);
        if (juyaReport) {
          await createDailyReport(date, juyaReport.content, [], []);
          reportCreated = true;
        }
      } catch (e) {
        console.warn(`[Backfill] Cannot create daily report for ${date}:`, e);
      }

      results.push({ date, newsCount, reportCreated, skipped: false });
      console.log(`[Backfill] ${date}: ${newsCount} news, report=${reportCreated}`);
    }

    const totalNews = results.reduce((sum, r) => sum + r.newsCount, 0);
    const totalReports = results.filter(r => r.reportCreated).length;
    const skipped = results.filter(r => r.skipped).length;

    return NextResponse.json({
      success: true,
      message: `补充完成：${totalNews}条资讯入库，${totalReports}个日报创建，${skipped}天已存在跳过`,
      details: results,
    });
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "Unknown error";
    console.error("[Backfill] Failed:", errorMessage);
    return NextResponse.json(
      { error: "补充数据失败", detail: errorMessage },
      { status: 500 }
    );
  }
}
