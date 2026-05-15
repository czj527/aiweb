import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken, revokeAdminToken } from '@/lib/admin-auth';

export async function POST(request: NextRequest) {
  const token = request.cookies.get('admin_token')?.value;

  if (!token || !verifyAdminToken(token)) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  revokeAdminToken(token);

  const response = NextResponse.json({ success: true });
  response.cookies.delete('admin_token');
  return response;
}
