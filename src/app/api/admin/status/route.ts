import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/admin-auth";
import { getSupabaseClient } from "@/storage/database/supabase-client";

/**
 * GET /api/admin/status
 * 返回系统状态信息，供管理控制台使用
 * 需要 admin 登录验证
 * Supabase 不可用时降级返回基本状态
 */
export async function GET(request: NextRequest) {
  const token = request.cookies.get("admin_token")?.value;
  if (!token || !verifyAdminToken(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date().toISOString().split("T")[0];
  const oneDayAgo = new Date(Date.now() - 86400000).toISOString();

  const result = {
    supabaseOk: false,
    todayReport: null as { id: string; report_date: string } | null,
    latestReportDate: null as string | null,
    newsCount24h: -1,
    leaderboardCount: -1,
    recentLogs: [] as Array<{
      type: string;
      targetDate: string;
      status: string;
      createdAt: string;
      errorMessage?: string;
    }>,
    juyaRssOk: false,
  };

  // 1. 检查橘鸦 RSS（不依赖 Supabase）
  result.juyaRssOk = await checkJuyaRss();

  // 2. 检查 Supabase 连接及查询数据
  try {
    const client = getSupabaseClient();

    // 连接测试
    const { error: connError } = await client
      .from("daily_reports")
      .select("id")
      .limit(1);
    if (connError) {
      console.warn("[AdminStatus] Supabase query error:", connError.message);
      return NextResponse.json(result);
    }
    result.supabaseOk = true;

    // 今日日报
    const { data: todayData } = await client
      .from("daily_reports")
      .select("id, report_date")
      .eq("report_date", today)
      .limit(1);
    if (todayData && todayData.length > 0) {
      result.todayReport = { id: todayData[0].id, report_date: todayData[0].report_date };
    }

    // 最新日报日期
    const { data: latestData } = await client
      .from("daily_reports")
      .select("report_date")
      .eq("status", "published")
      .order("report_date", { ascending: false })
      .limit(1);
    if (latestData && latestData.length > 0) {
      result.latestReportDate = latestData[0].report_date;
    }

    // 24h新闻数
    const { count: newsCount } = await client
      .from("news_items")
      .select("*", { count: "exact", head: true })
      .gte("created_at", oneDayAgo);
    result.newsCount24h = newsCount || 0;

    // 排行榜条目数
    const { count: lbCount } = await client
      .from("model_leaderboard")
      .select("*", { count: "exact", head: true });
    result.leaderboardCount = lbCount || 0;

    // 最近5条 generation_logs
    const { data: logsData } = await client
      .from("generation_logs")
      .select("type, target_date, status, created_at, error_message")
      .order("created_at", { ascending: false })
      .limit(5);
    if (logsData) {
      result.recentLogs = logsData.map((log) => ({
        type: log.type,
        targetDate: log.target_date,
        status: log.status,
        createdAt: log.created_at,
        errorMessage: log.error_message || undefined,
      }));
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.warn("[AdminStatus] Supabase unavailable:", msg);
  }

  return NextResponse.json(result);
}

/** 检查橘鸦RSS是否可访问（3秒超时） */
async function checkJuyaRss(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const response = await fetch("https://imjuya.github.io/juya-ai-daily/rss.xml", {
      signal: controller.signal,
      method: "HEAD",
    });
    clearTimeout(timeout);
    return response.ok;
  } catch {
    return false;
  }
}
