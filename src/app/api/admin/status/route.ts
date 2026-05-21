import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/admin-auth";
import { getSupabaseClient } from "@/storage/database/supabase-client";

/**
 * GET /api/admin/status
 * 返回系统状态信息，供管理控制台使用
 * 需要 admin 登录验证
 */
export async function GET(request: NextRequest) {
  // 验证 admin 登录
  const token = request.cookies.get("admin_token")?.value;
  if (!token || !verifyAdminToken(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = getSupabaseClient();
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  const oneDayAgo = new Date(Date.now() - 86400000).toISOString();

  // 初始化结果对象，所有字段默认降级值
  const result: {
    supabaseOk: boolean;
    todayReport: { id: string; report_date: string } | null;
    latestReportDate: string | null;
    newsCount24h: number;
    leaderboardCount: number;
    recentLogs: Array<{
      type: string;
      targetDate: string;
      status: string;
      createdAt: string;
      errorMessage?: string;
    }>;
    juyaRssOk: boolean;
  } = {
    supabaseOk: false,
    todayReport: null,
    latestReportDate: null,
    newsCount24h: -1,
    leaderboardCount: -1,
    recentLogs: [],
    juyaRssOk: false,
  };

  // 1. 检查 Supabase 连接
  try {
    const { error } = await client
      .from("daily_reports")
      .select("id")
      .limit(1);
    result.supabaseOk = !error;
  } catch {
    result.supabaseOk = false;
  }

  // 2. 检查今日日报
  try {
    const { data, error } = await client
      .from("daily_reports")
      .select("id, report_date")
      .eq("report_date", today)
      .limit(1);
    if (!error && data && data.length > 0) {
      result.todayReport = { id: data[0].id, report_date: data[0].report_date };
    }
  } catch {
    // 降级保留 null
  }

  // 3. 获取最新日报日期
  try {
    const { data, error } = await client
      .from("daily_reports")
      .select("report_date")
      .eq("status", "published")
      .order("report_date", { ascending: false })
      .limit(1);
    if (!error && data && data.length > 0) {
      result.latestReportDate = data[0].report_date;
    }
  } catch {
    // 降级保留 null
  }

  // 4. 获取最近24小时新闻数
  try {
    const { count, error } = await client
      .from("news_items")
      .select("*", { count: "exact", head: true })
      .gte("created_at", oneDayAgo);
    if (!error) {
      result.newsCount24h = count || 0;
    }
  } catch {
    // 降级保留 -1
  }

  // 5. 获取排行榜条目数
  try {
    const { count, error } = await client
      .from("model_leaderboard")
      .select("*", { count: "exact", head: true });
    if (!error) {
      result.leaderboardCount = count || 0;
    }
  } catch {
    // 降级保留 -1
  }

  // 6. 获取最近5条 generation_logs
  try {
    const { data, error } = await client
      .from("generation_logs")
      .select("type, target_date, status, created_at, error_message")
      .order("created_at", { ascending: false })
      .limit(5);
    if (!error && data) {
      result.recentLogs = data.map((log) => ({
        type: log.type,
        targetDate: log.target_date,
        status: log.status,
        createdAt: log.created_at,
        errorMessage: log.error_message || undefined,
      }));
    }
  } catch {
    // 降级保留空数组
  }

  // 7. 检查橘鸦 RSS 是否可访问（3秒超时）
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const response = await fetch("https://juyaox.fun/feed", {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    result.juyaRssOk = response.ok;
  } catch {
    result.juyaRssOk = false;
  }

  return NextResponse.json(result);
}
