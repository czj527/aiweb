import { NextResponse } from 'next/server';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const revalidate = 60;

// GET /api/tools — 公开获取工具列表
export async function GET() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
  }

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/ai_tools?select=*&order=is_featured.desc,sort_order.asc,created_at.desc`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
        next: { revalidate: 60 },
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error('Supabase fetch tools error:', res.status, err);
      return NextResponse.json([], { status: 200 }); // 降级返回空数组
    }

    const tools = await res.json();
    return NextResponse.json(tools);
  } catch (err) {
    console.error('Fetch tools error:', err);
    return NextResponse.json([], { status: 200 });
  }
}
