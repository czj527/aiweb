import { NextRequest, NextResponse } from 'next/server';

// 延迟初始化 Supabase 客户端
function getSupabaseClient() {
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return { url: SUPABASE_URL, key: SUPABASE_KEY };
}

export const revalidate = 60;

// GET /api/radio — 公开获取播客列表
export async function GET(request: NextRequest) {
  const { url, key } = getSupabaseClient();

  if (!url || !key) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
  }

  // 获取分页参数
  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);
  const offset = (page - 1) * limit;

  try {
    const res = await fetch(
      `${url}/rest/v1/radio_broadcasts?select=*&order=date.desc,created_at.desc&limit=${limit}&offset=${offset}`,
      {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
        },
        next: { revalidate: 60 },
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error('Supabase fetch broadcasts error:', res.status, err);
      return NextResponse.json([], { status: 200 });
    }

    const broadcasts = await res.json();
    return NextResponse.json(broadcasts);
  } catch (err) {
    console.error('Fetch broadcasts error:', err);
    return NextResponse.json([], { status: 200 });
  }
}
