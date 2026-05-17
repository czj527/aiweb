import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken } from '@/lib/admin-auth';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// GET /api/admin/ai/status — AI 管理仪表盘统计数据
export async function GET(request: NextRequest) {
  const token = request.cookies.get('admin_token')?.value;
  if (!token || !verifyAdminToken(token)) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  try {
    const supabase = getSupabaseClient();

    // 并行查询所有统计数据
    const [
      totalNewsResult,
      publishedNewsResult,
      pendingNewsResult,
      totalDailyReportsResult,
      totalWeeklyReportsResult,
      recentLogsResult,
      recentNewsResult,
    ] = await Promise.all([
      supabase
        .from('news_items')
        .select('*', { count: 'exact', head: true }),
      supabase
        .from('news_items')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'published'),
      supabase
        .from('news_items')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending'),
      supabase
        .from('daily_reports')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'published'),
      supabase
        .from('weekly_reports')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'published'),
      supabase
        .from('generation_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('news_items')
        .select('id, title, category, importance_level, source_name, published_at')
        .order('published_at', { ascending: false })
        .limit(5),
    ]);

    return NextResponse.json({
      success: true,
      stats: {
        totalNews: totalNewsResult.count ?? 0,
        publishedNews: publishedNewsResult.count ?? 0,
        pendingNews: pendingNewsResult.count ?? 0,
        totalDailyReports: totalDailyReportsResult.count ?? 0,
        totalWeeklyReports: totalWeeklyReportsResult.count ?? 0,
      },
      recentLogs: recentLogsResult.data ?? [],
      recentNews: recentNewsResult.data ?? [],
    });
  } catch (e) {
    console.error('[AI Status] Error:', e);
    return NextResponse.json({ error: '获取状态数据失败' }, { status: 500 });
  }
}
