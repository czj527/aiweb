import { NextRequest, NextResponse } from 'next/server';
import { getWeeklyDigest } from '@/lib/services/db-service';

// GET /api/weekly/[id] — 周报详情
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await getWeeklyDigest(id);
    if (!data) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error('[weekly/id] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
