import { NextRequest, NextResponse } from 'next/server';
import { getWeeklyDigestList } from '@/lib/services/db-service';

// GET /api/weekly — 周报列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const data = await getWeeklyDigestList(Math.min(limit, 50));
    return NextResponse.json({ items: data });
  } catch (error) {
    console.error('[weekly] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
