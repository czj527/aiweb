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
 * 
 * Supabase 不可用时降级处理
 */

/** 安全写入日志：Supabase 不可用时跳过 */
async function safeCreateLog(type: "daily" | "weekly" | "collect" | "daily-sync" | "rss-collect" | "juya-check" | "leaderboard", targetDate: string): Promise<string | null> {
  try {
    return await createGenerationLog(type, targetDate);
  } catch {
    console.warn(`[DailyGenerate] Cannot create log (Supabase unavailable), skipping`);
    return null;
  }
}

async function safeUpdateLog(id: string | null, data: { status: string; errorMessage?: string }) {
  if (!id) return;
  try {
    await updateGenerationLog(id, data);
  } catch {
    console.warn(`[DailyGenerate] Cannot update log (Supabase unavailable), skipping`);
  }
}

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

  const logId = await safeCreateLog("daily", targetDate);

  try {
    // 检查是否已存在该日期的日报（Supabase 不可用时跳过检查）
    if (!force && logId) {
      try {
        const existing = await getDailyReportByDate(targetDate);
        if (existing) {
          await safeUpdateLog(logId, { status: "skipped", errorMessage: "Report already exists" });
          return NextResponse.json({
            success: true,
            reportId: existing.id,
            date: targetDate,
            message: "该日期的日报已存在",
          });
        }
      } catch {
        console.warn("[DailyGenerate] Cannot check existing report (Supabase unavailable), proceeding anyway");
      }
    }

    // 直接获取橘鸦日报HTML内容
    console.log(`[DailyGenerate] Fetching 橘鸦 daily report for ${targetDate}`);
    const juyaReport = await fetchJuyaDailyReport();

    if (!juyaReport) {
      await safeUpdateLog(logId, { status: "empty", errorMessage: "No content from RSS" });
      return NextResponse.json({ success: true, message: "橘鸦RSS暂无更新" });
    }

    // 创建日报记录（Supabase 不可用时跳过）
    let reportId: string | null = null;
    try {
      reportId = await createDailyReport(targetDate, juyaReport.content, [], []);
    } catch {
      console.warn("[DailyGenerate] Cannot create daily report in DB (Supabase unavailable)");
    }

    // 更新生成日志
    await safeUpdateLog(logId, { status: "success" });

    console.log(`[DailyGenerate] Created report ${reportId} for ${targetDate}`);

    return NextResponse.json({
      success: true,
      reportId,
      date: targetDate,
      title: juyaReport.title,
      message: "日报生成成功",
    });
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "Unknown error";
    console.error(`[DailyGenerate] Failed:`, errorMessage);

    await safeUpdateLog(logId, {
      status: "failed",
      errorMessage,
    });

    return NextResponse.json(
      { error: "日报生成失败", detail: errorMessage },
      { status: 500 }
    );
  }
}
