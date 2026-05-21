import { NextRequest, NextResponse } from "next/server";
import { fetchJuyaDailyReport } from "@/lib/services/rss-fetch-service";
import {
  createDailyReport,
  createGenerationLog,
  updateGenerationLog,
  getDailyReportByDate,
} from "@/lib/services/db-service";

/**
 * POST /api/daily/generate
 * 直接获取橘鸦日报并缓存到数据库
 *
 * 可选 body 参数：
 * - date: 指定日期 (YYYY-MM-DD)，默认今天
 * - force: 强制重新生成（即使已存在）
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const today = new Date().toISOString().slice(0, 10);
  const targetDate = body.date || today;
  const force = body.force === true;

  // 验证日期格式
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    return NextResponse.json(
      { error: "日期格式错误，请使用 YYYY-MM-DD" },
      { status: 400 }
    );
  }

  const logId = await createGenerationLog("daily", targetDate);

  try {
    // 检查是否已存在该日期的日报
    if (!force) {
      const existing = await getDailyReportByDate(targetDate);
      if (existing) {
        await updateGenerationLog(logId, { status: "skipped", errorMessage: "Report already exists" });
        return NextResponse.json({
          success: true,
          reportId: existing.id,
          date: targetDate,
          message: "该日期的日报已存在",
        });
      }
    }

    // 直接获取橘鸦日报HTML内容
    console.log(`[Daily Generate] Fetching 橘鸦 daily report for ${targetDate}`);
    const overview = await fetchJuyaDailyReport();

    // 创建日报记录
    const reportId = await createDailyReport(targetDate, overview, [], []);

    // 更新生成日志
    await updateGenerationLog(logId, {
      status: "success",
    });

    console.log(`[Daily Generate] Created report ${reportId} for ${targetDate}`);

    return NextResponse.json({
      success: true,
      reportId,
      date: targetDate,
      message: "日报生成成功",
    });
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "Unknown error";
    console.error(`[Daily Generate] Failed:`, errorMessage);

    await updateGenerationLog(logId, {
      status: "failed",
      errorMessage,
    });

    return NextResponse.json(
      { error: "日报生成失败", detail: errorMessage },
      { status: 500 }
    );
  }
}
