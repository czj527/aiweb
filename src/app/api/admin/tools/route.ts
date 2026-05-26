import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken } from '@/lib/admin-auth';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const headers = () => ({
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
});

// GET /api/admin/tools — 管理员获取全部工具
export async function GET(request: NextRequest) {
  const cookie = request.cookies.get('admin_token')?.value;
  if (!verifyAdminToken(cookie || '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/ai_tools?select=*&order=sort_order.asc,created_at.desc`,
      { headers: headers() }
    );

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `Supabase error: ${err}` }, { status: res.status });
    }

    const tools = await res.json();
    return NextResponse.json(tools);
  } catch (err) {
    return NextResponse.json({ error: 'Network error' }, { status: 500 });
  }
}

// POST /api/admin/tools — 添加工具
export async function POST(request: NextRequest) {
  const cookie = request.cookies.get('admin_token')?.value;
  if (!verifyAdminToken(cookie || '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, description, url, icon_url, category, is_featured, sort_order } = body;

    if (!name || !url) {
      return NextResponse.json({ error: 'name and url are required' }, { status: 400 });
    }

    const res = await fetch(`${SUPABASE_URL}/rest/v1/ai_tools`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        name,
        description: description || '',
        url,
        icon_url: icon_url || null,
        category: category || '其他',
        is_featured: is_featured || false,
        sort_order: sort_order || 0,
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

// PATCH /api/admin/tools — 更新工具
export async function PATCH(request: NextRequest) {
  const cookie = request.cookies.get('admin_token')?.value;
  if (!verifyAdminToken(cookie || '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/ai_tools?id=eq.${id}`,
      {
        method: 'PATCH',
        headers: headers(),
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

// DELETE /api/admin/tools — 删除工具
export async function DELETE(request: NextRequest) {
  const cookie = request.cookies.get('admin_token')?.value;
  if (!verifyAdminToken(cookie || '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/ai_tools?id=eq.${id}`,
      {
        method: 'DELETE',
        headers: { ...headers(), Prefer: 'return=representation' },
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
