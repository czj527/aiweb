import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken } from '@/lib/admin-auth';
import { cleanupOldData, getWeekRange } from '@/lib/services/db-service';

// POST /api/admin/cleanup — 清理过期数据
// 安全要求：必须传 confirm=true 防止误触
// 建议每周日晚执行，但不做强制限制（方便调试）
export async function POST(request: NextRequest) {
  const cookie = request.cookies.get('admin_token')?.value;
  if (!verifyAdminToken(cookie || '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    
    // 安全确认参数
    if (body.confirm !== true) {
      const { weekStart, weekEnd } = getWeekRange();
      return NextResponse.json({
        success: false,
        error: '需要确认参数',
        hint: '请传入 { "confirm": true } 以确认执行清理操作',
        preview: `将清理 ${weekStart} 之前的数据（${weekStart} ~ ${weekEnd} 的数据将保留）`,
      });
    }

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
