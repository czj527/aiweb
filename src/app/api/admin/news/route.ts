import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken } from '@/lib/admin-auth';
import { getAllNewsItems, deleteNewsItem, deleteNewsFromReports } from '@/lib/services/db-service';

// GET /api/admin/news — 获取所有新闻（管理用）
export async function GET(request: NextRequest) {
  const token = request.cookies.get('admin_token')?.value;
  if (!token || !verifyAdminToken(token)) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const date = url.searchParams.get('date') || undefined;
    const category = url.searchParams.get('category') || undefined;
    const limit = parseInt(url.searchParams.get('limit') || '100', 10);

    const result = await getAllNewsItems({ date, category, limit });
    return NextResponse.json({ success: true, data: result });
  } catch (e) {
    console.error('[Admin News] List error:', e);
    return NextResponse.json({ error: '获取新闻列表失败' }, { status: 500 });
  }
}

// DELETE /api/admin/news — 删除新闻
export async function DELETE(request: NextRequest) {
  const token = request.cookies.get('admin_token')?.value;
  if (!token || !verifyAdminToken(token)) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id } = body as { id: string };

    if (!id) {
      return NextResponse.json({ error: '缺少新闻ID' }, { status: 400 });
    }

    // 先从日报/周报关联中删除
    await deleteNewsFromReports(id);
    // 再删除新闻本身
    await deleteNewsItem(id);

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[Admin News] Delete error:', e);
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}
