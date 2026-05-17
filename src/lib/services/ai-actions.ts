/**
 * AI Admin Actions
 * Functions for the AI assistant to execute actions and query the database
 */

import { getSupabaseClient } from "@/storage/database/supabase-client";

/** Execute a system action (collect, generate_daily, generate_weekly, fetch_leaderboard) */
export async function executeAction(
  action: string
): Promise<{ success: boolean; message: string; data?: unknown }> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:5000";

  const endpoints: Record<string, { url: string; method: string; body?: Record<string, unknown> }> = {
    collect: { url: "/api/news/collect", method: "POST" },
    generate_daily: { url: "/api/daily/generate", method: "POST" },
    generate_weekly: { url: "/api/weekly/generate", method: "POST" },
    fetch_leaderboard: {
      url: "/api/leaderboard/fetch",
      method: "POST",
      body: { source: "datalearner-aa" },
    },
  };

  const config = endpoints[action];
  if (!config) {
    return { success: false, message: `未知操作: ${action}` };
  }

  try {
    const res = await fetch(`${baseUrl}${config.url}`, {
      method: config.method,
      headers: { "Content-Type": "application/json" },
      body: config.body ? JSON.stringify(config.body) : undefined,
    });

    const data = await res.json();
    if (!res.ok) {
      return { success: false, message: data.error || `操作失败 (${res.status})`, data };
    }
    return { success: true, message: `操作 ${action} 已执行成功`, data };
  } catch (e) {
    return { success: false, message: `执行操作 ${action} 出错: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/** Query the database for various types of information */
export async function queryDatabase(
  queryType: string,
  params?: Record<string, unknown>
): Promise<{ success: boolean; message: string; data?: unknown }> {
  const client = getSupabaseClient();
  const limit = (params?.limit as number) || 10;
  const category = params?.category as string | undefined;
  const status = params?.status as string | undefined;

  try {
    switch (queryType) {
      case "news_count": {
        const { count, error } = await client
          .from("news_items")
          .select("*", { count: "exact", head: true });
        if (error) throw error;
        return { success: true, message: `共 ${count ?? 0} 条新闻`, data: { count } };
      }

      case "recent_news": {
        let query = client
          .from("news_items")
          .select("id, title, category, importance_level, importance_score, status, published_at")
          .order("published_at", { ascending: false })
          .limit(limit);
        if (category) query = query.eq("category", category);
        if (status) query = query.eq("status", status);
        const { data, error } = await query;
        if (error) throw error;
        return { success: true, message: `查询到 ${data?.length ?? 0} 条新闻`, data };
      }

      case "pending_news": {
        const { data, error } = await client
          .from("news_items")
          .select("id, title, category, importance_level, importance_score, published_at")
          .eq("status", "pending")
          .order("importance_score", { ascending: false })
          .limit(limit);
        if (error) throw error;
        return { success: true, message: `共 ${data?.length ?? 0} 条待审核新闻`, data };
      }

      case "daily_reports": {
        const { data, error } = await client
          .from("daily_reports")
          .select("id, report_date, news_count, status, overview")
          .order("report_date", { ascending: false })
          .limit(limit);
        if (error) throw error;
        return { success: true, message: `查询到 ${data?.length ?? 0} 篇日报`, data };
      }

      case "weekly_reports": {
        const { data, error } = await client
          .from("weekly_reports")
          .select("id, week_start_date, week_end_date, week_number, news_count, status, overview")
          .order("week_start_date", { ascending: false })
          .limit(limit);
        if (error) throw error;
        return { success: true, message: `查询到 ${data?.length ?? 0} 篇周报`, data };
      }

      case "generation_logs": {
        const { data, error } = await client
          .from("generation_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(limit);
        if (error) throw error;
        return { success: true, message: `查询到 ${data?.length ?? 0} 条日志`, data };
      }

      default:
        return { success: false, message: `未知查询类型: ${queryType}` };
    }
  } catch (e) {
    return {
      success: false,
      message: `查询 ${queryType} 出错: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

/** Save a memory (upsert by key) */
export async function saveMemory(
  key: string,
  value: string,
  category: string = 'general'
): Promise<{ success: boolean; message: string; data?: unknown }> {
  const client = getSupabaseClient();

  try {
    const { data, error } = await client
      .from('ai_memories')
      .upsert({ key, value, category }, { onConflict: 'key' })
      .select()
      .single();

    if (error) {
      if (error.message?.includes('does not exist') || error.code === '42P01') {
        return { success: false, message: 'ai_memories 表尚未创建，请联系管理员执行数据库迁移' };
      }
      throw error;
    }

    return { success: true, message: `记忆「${key}」已保存`, data };
  } catch (e) {
    return { success: false, message: `保存记忆失败: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/** Delete a memory by key */
export async function deleteMemory(
  key: string
): Promise<{ success: boolean; message: string }> {
  const client = getSupabaseClient();

  try {
    const { error } = await client
      .from('ai_memories')
      .delete()
      .eq('key', key);

    if (error) {
      if (error.message?.includes('does not exist') || error.code === '42P01') {
        return { success: false, message: 'ai_memories 表尚未创建' };
      }
      throw error;
    }

    return { success: true, message: `记忆「${key}」已删除` };
  } catch (e) {
    return { success: false, message: `删除记忆失败: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/** Load all memories for injection into system prompt */
export async function loadMemories(): Promise<Array<{ key: string; value: string; category: string }>> {
  const client = getSupabaseClient();

  try {
    const { data, error } = await client
      .from('ai_memories')
      .select('key, value, category')
      .order('category', { ascending: true })
      .order('key', { ascending: true });

    if (error) {
      // Table doesn't exist yet — return empty gracefully
      if (error.message?.includes('does not exist') || error.code === '42P01') {
        return [];
      }
      console.warn('[loadMemories] Error:', error.message);
      return [];
    }

    return data ?? [];
  } catch (e) {
    console.warn('[loadMemories] Error:', e instanceof Error ? e.message : String(e));
    return [];
  }
}
