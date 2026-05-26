import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken } from '@/lib/admin-auth';

// 延迟初始化 Supabase 客户端
function getSupabaseClient() {
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return { url: SUPABASE_URL, key: SUPABASE_KEY };
}

const getHeaders = () => {
  const { key } = getSupabaseClient();
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };
};

// 验证管理权限
function verifyAdmin(request: NextRequest) {
  // 优先验证 cookie token
  const cookie = request.cookies.get('admin_token')?.value;
  if (verifyAdminToken(cookie || '')) return true;

  // 备用：验证 header 中的 admin-password
  const adminPassword = request.headers.get('admin-password');
  if (adminPassword === process.env.ADMIN_PASSWORD) return true;

  return false;
}

// GET /api/admin/radio — 管理员获取全部播客
export async function GET(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { url, key } = getSupabaseClient();

  try {
    const res = await fetch(
      `${url}/rest/v1/radio_broadcasts?select=*&order=date.desc,created_at.desc`,
      { headers: getHeaders() }
    );

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `Supabase error: ${err}` }, { status: res.status });
    }

    const broadcasts = await res.json();
    return NextResponse.json(broadcasts);
  } catch (err) {
    return NextResponse.json({ error: 'Network error' }, { status: 500 });
  }
}

// POST /api/admin/radio — 新增播客记录
export async function POST(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { url, key } = getSupabaseClient();

  try {
    const body = await request.json();
    const { title, description, audio_url, duration, date, category } = body;

    if (!title || !audio_url || !date) {
      return NextResponse.json({ error: 'title, audio_url, and date are required' }, { status: 400 });
    }

    const res = await fetch(`${url}/rest/v1/radio_broadcasts`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        title,
        description: description || '',
        audio_url,
        duration: duration || null,
        date,
        category: category || 'daily',
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `Insert failed: ${err}` }, { status: res.status });
    }

    const inserted = await res.json();
    return NextResponse.json(inserted[0], { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: 'Network error' }, { status: 500 });
  }
}

// PATCH /api/admin/radio — 更新播客
export async function PATCH(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { url, key } = getSupabaseClient();

  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const res = await fetch(
      `${url}/rest/v1/radio_broadcasts?id=eq.${id}`,
      {
        method: 'PATCH',
        headers: {
          ...getHeaders(),
          Prefer: 'return=representation',
        },
        body: JSON.stringify({ ...updates, updated_at: new Date().toISOString() }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `Update failed: ${err}` }, { status: res.status });
    }

    const updated = await res.json();
    return NextResponse.json(updated[0]);
  } catch (err) {
    return NextResponse.json({ error: 'Network error' }, { status: 500 });
  }
}

// DELETE /api/admin/radio — 删除播客
export async function DELETE(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { url, key } = getSupabaseClient();

  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const res = await fetch(
      `${url}/rest/v1/radio_broadcasts?id=eq.${id}`,
      {
        method: 'DELETE',
        headers: { ...getHeaders(), Prefer: 'return=representation' },
      }
    );

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `Delete failed: ${err}` }, { status: res.status });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Network error' }, { status: 500 });
  }
}
