import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken } from '@/lib/admin-auth';
import { cleanupOldData, getWeekRange } from '@/lib/services/db-service';

// POST /api/admin/cleanup — 清理过期数据
export async function POST(request: NextRequest) {
  const cookie = request.cookies.get('admin_token')?.value;
  if (!verifyAdminToken(cookie || '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { weekStart } = getWeekRange();
    const results = await cleanupOldData(weekStart);

    return NextResponse.json({
      success: true,
      message: `数据清理完成：删除${results.newsDeleted}条新闻，清理${results.reportsCleared}份日报正文，删除${results.associationsDeleted}条关联，删除${results.logsDeleted}条日志`,
      results,
      weekStart,
    });
  } catch (error) {
    console.error('[cleanup] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
