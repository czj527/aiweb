import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * 获取 Supabase 配置
 * 从环境变量读取（优先 SUPABASE_*，兼容旧 COZE_SUPABASE_*）
 */
function getSupabaseCredentials(): { url: string; anonKey: string } {
  const url = process.env.SUPABASE_URL || process.env.COZE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.COZE_SUPABASE_ANON_KEY;
  if (!url) throw new Error('SUPABASE_URL unset');
  if (!anonKey) throw new Error('SUPABASE_ANON_KEY unset');
  return { url, anonKey };
}

function getSupabaseServiceRoleKey(): string | undefined {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.COZE_SUPABASE_SERVICE_ROLE_KEY;
}

function getSupabaseClient(token?: string): SupabaseClient {
  const { url, anonKey } = getSupabaseCredentials();
  const key = token ? anonKey : (getSupabaseServiceRoleKey() ?? anonKey);
  const opts: Record<string, unknown> = {};
  if (token) opts.headers = { Authorization: 'Bearer ' + token };
  return createClient(url, key, { global: opts, db: { timeout: 60000 }, auth: { autoRefreshToken: false, persistSession: false } });
}

export { getSupabaseClient };
