import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken } from '@/lib/admin-auth';

// POST /api/admin/setup — 创建缺失的数据库表
export async function POST(request: NextRequest) {
  // 管理员鉴权
  const cookie = request.cookies.get('admin_token')?.value;
  if (!verifyAdminToken(cookie || '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL || '';
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
  }

  const results: string[] = [];

  // 检查 weekly_digests 表是否存在，不存在则创建
  // Supabase PostgREST 无法直接建表，但可以通过插入测试来检测
  // 如果表不存在，PostgREST会返回特定错误
  
  // 尝试查询 weekly_digests 表
  const checkRes = await fetch(
    `${SUPABASE_URL}/rest/v1/weekly_digests?select=id&limit=1`,
    {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    }
  );

  if (checkRes.status === 404) {
    // 表不存在，需要通过SQL创建
    // PostgREST不支持DDL，返回建表SQL让用户手动执行
    const createSQL = `
-- 创建 weekly_digests 表
CREATE TABLE IF NOT EXISTS weekly_digests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  hot_topics TEXT[] DEFAULT '{}',
  news_count INTEGER DEFAULT 0,
  categories TEXT[] DEFAULT '{}',
  content TEXT NOT NULL DEFAULT '',
  status TEXT DEFAULT 'published',
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 唯一约束：每周只能有一份周报
CREATE UNIQUE INDEX IF NOT EXISTS weekly_digests_week_start_key ON weekly_digests (week_start);

-- 启用 RLS
ALTER TABLE weekly_digests ENABLE ROW LEVEL SECURITY;

-- 允许匿名读取已发布的周报
CREATE POLICY "Published digests are publicly readable" ON weekly_digests
  FOR SELECT USING (status = 'published');

-- 允许 service_role 完全访问
CREATE POLICY "Service role full access" ON weekly_digests
  FOR ALL USING (true) WITH CHECK (true);
`;
    return NextResponse.json({
      message: 'weekly_digests 表不存在，请在 Supabase SQL Editor 中执行以下 SQL',
      sql: createSQL.trim(),
    });
  }

  if (checkRes.ok) {
    results.push('weekly_digests 表已存在 ✅');
  } else {
    results.push(`weekly_digests 检查异常: ${checkRes.status}`);
  }

  return NextResponse.json({ results });
}
