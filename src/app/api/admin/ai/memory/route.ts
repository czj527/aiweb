/**
 * AI Memory Management API
 * CRUD operations for the ai_memories table
 * 
 * Table schema (run in Supabase SQL editor):
 * 
 * CREATE TABLE IF NOT EXISTS ai_memories (
 *   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *   key TEXT NOT NULL UNIQUE,
 *   value TEXT NOT NULL,
 *   category TEXT NOT NULL DEFAULT 'general',
 *   created_at TIMESTAMPTZ DEFAULT now(),
 *   updated_at TIMESTAMPTZ DEFAULT now()
 * );
 * 
 * CREATE INDEX IF NOT EXISTS idx_ai_memories_category ON ai_memories(category);
 * CREATE INDEX IF NOT EXISTS idx_ai_memories_key ON ai_memories(key);
 * 
 * -- Auto-update updated_at on row change
 * CREATE OR REPLACE FUNCTION update_ai_memories_timestamp()
 * RETURNS TRIGGER AS $$
 * BEGIN
 *   NEW.updated_at = now();
 *   RETURN NEW;
 * END;
 * $$ LANGUAGE plpgsql;
 * 
 * DROP TRIGGER IF EXISTS trigger_update_ai_memories_timestamp ON ai_memories;
 * CREATE TRIGGER trigger_update_ai_memories_timestamp
 *   BEFORE UPDATE ON ai_memories
 *   FOR EACH ROW
 *   EXECUTE FUNCTION update_ai_memories_timestamp();
 */

import { NextRequest } from 'next/server';
import { verifyAdminToken } from '@/lib/admin-auth';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function GET(request: NextRequest) {
  // Auth check
  const token = request.cookies.get('admin_token')?.value;
  if (!token || !verifyAdminToken(token)) {
    return Response.json({ error: '未授权' }, { status: 401 });
  }

  const client = getSupabaseClient();

  try {
    const { data, error } = await client
      .from('ai_memories')
      .select('*')
      .order('category', { ascending: true })
      .order('key', { ascending: true });

    if (error) {
      // If table doesn't exist, return empty list gracefully
      if (error.message?.includes('does not exist') || error.code === '42P01') {
        return Response.json({ success: true, data: [], message: 'ai_memories 表尚未创建，请执行迁移 SQL' });
      }
      throw error;
    }

    return Response.json({ success: true, data: data ?? [] });
  } catch (e) {
    const message = e instanceof Error ? e.message : '查询失败';
    console.error('[AI Memory GET] Error:', message);
    return Response.json({ success: false, error: message, data: [] }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  // Auth check
  const token = request.cookies.get('admin_token')?.value;
  if (!token || !verifyAdminToken(token)) {
    return Response.json({ error: '未授权' }, { status: 401 });
  }

  let body: { key?: string; value?: string; category?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: '请求格式错误' }, { status: 400 });
  }

  const { key, value, category = 'general' } = body;
  if (!key?.trim() || !value?.trim()) {
    return Response.json({ error: 'key 和 value 不能为空' }, { status: 400 });
  }

  const client = getSupabaseClient();

  try {
    // Upsert: insert or update if key exists
    const { data, error } = await client
      .from('ai_memories')
      .upsert(
        { key: key.trim(), value: value.trim(), category: category.trim() },
        { onConflict: 'key' }
      )
      .select()
      .single();

    if (error) {
      if (error.message?.includes('does not exist') || error.code === '42P01') {
        return Response.json({
          success: false,
          error: 'ai_memories 表尚未创建，请先在 Supabase SQL Editor 中执行迁移 SQL',
        }, { status: 500 });
      }
      throw error;
    }

    return Response.json({ success: true, data });
  } catch (e) {
    const message = e instanceof Error ? e.message : '保存失败';
    console.error('[AI Memory POST] Error:', message);
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  // Auth check
  const token = request.cookies.get('admin_token')?.value;
  if (!token || !verifyAdminToken(token)) {
    return Response.json({ error: '未授权' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const key = searchParams.get('key');

  if (!id && !key) {
    return Response.json({ error: '需要提供 id 或 key 参数' }, { status: 400 });
  }

  const client = getSupabaseClient();

  try {
    let query = client.from('ai_memories').delete();
    if (id) {
      query = query.eq('id', id);
    } else if (key) {
      query = query.eq('key', key);
    }

    const { error } = await query;

    if (error) {
      if (error.message?.includes('does not exist') || error.code === '42P01') {
        return Response.json({ success: false, error: 'ai_memories 表尚未创建' }, { status: 500 });
      }
      throw error;
    }

    return Response.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : '删除失败';
    console.error('[AI Memory DELETE] Error:', message);
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
