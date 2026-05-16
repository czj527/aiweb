import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";

/**
 * POST /api/news/insert
 * 批量插入新闻条目（供外部采集使用）
 * 需要 CRON_SECRET 认证
 */
export async function POST(request: NextRequest) {
  const auth = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (process.env.CRON_SECRET && auth !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const items = body.items;

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "items array required" }, { status: 400 });
  }

  const client = getSupabaseClient();
  const results: { inserted: number; skipped: number; errors: string[] } = {
    inserted: 0,
    skipped: 0,
    errors: [],
  };

  for (const item of items) {
    try {
      // URL去重检查
      const { data: existing } = await client
        .from("news_items")
        .select("id")
        .eq("source_url", item.source_url)
        .limit(1);

      if (existing && existing.length > 0) {
        results.skipped++;
        continue;
      }

      const { error } = await client.from("news_items").insert({
        id: crypto.randomUUID(),
        title: item.title,
        summary: item.summary,
        source_name: item.source_name,
        source_url: item.source_url,
        category: item.category || "product",
        importance_score: item.importance_score || 15,
        importance_level: item.importance_level || "S",
        keywords: item.keywords || [],
        is_ai_related: item.is_ai_related !== false,
        published_at: item.published_at || new Date().toISOString(),
        status: "published",
      });

      if (error) {
        results.errors.push(`${item.title}: ${error.message}`);
      } else {
        results.inserted++;
      }
    } catch (e) {
      results.errors.push(`${item.title}: ${(e as Error).message}`);
    }
  }

  return NextResponse.json({ success: true, results });
}
