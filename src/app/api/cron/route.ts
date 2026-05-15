import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/cron
 * Railway Cron 定时任务调用端点
 *
 * body: { task: "collect" | "daily" | "weekly" | "leaderboard" | "all" }
 * 需要设置 CRON_SECRET 环境变量作为认证
 */

const CRON_SECRET = process.env.CRON_SECRET || "";

export async function POST(request: NextRequest) {
  // 验证 cron secret
  const auth = request.headers.get("authorization")?.replace("Bearer ", "");
  if (CRON_SECRET && auth !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const task = body.task || "all";
  const baseUrl = process.env.SITE_URL || `http://localhost:${process.env.PORT || 5000}`;

  const taskEndpoints: Record<string, string[]> = {
    collect: ["/api/news/collect"],
    daily: ["/api/news/collect", "/api/daily/generate"],
    weekly: ["/api/weekly/generate"],
    leaderboard: [
      "/api/leaderboard/fetch",
    ],
    all: [
      "/api/news/collect",
      "/api/daily/generate",
      "/api/leaderboard/fetch",
    ],
  };

  const endpoints = taskEndpoints[task] || taskEndpoints.all;
  const results: { endpoint: string; status: number }[] = [];

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(`${baseUrl}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      results.push({ endpoint, status: res.status });
    } catch (e) {
      results.push({
        endpoint,
        status: 0,
      });
    }
  }

  const allSuccess = results.every((r) => r.status >= 200 && r.status < 300);

  return NextResponse.json({
    success: allSuccess,
    task,
    results,
  });
}
