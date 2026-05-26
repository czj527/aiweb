import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminPassword, createAdminSession } from '@/lib/admin-auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password } = body as { password: string };

    if (!password) {
      return NextResponse.json({ error: '请输入密码' }, { status: 400 });
    }

    if (!verifyAdminPassword(password)) {
      return NextResponse.json({ error: '密码错误' }, { status: 401 });
    }

    const token = createAdminSession();

    const response = NextResponse.json({
      success: true,
      token,
    });

    // 设置 HttpOnly cookie
    response.cookies.set('admin_token', token, {
      httpOnly: true,
      secure: process.env.COZE_PROJECT_ENV === 'PROD',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60, // 24小时
      path: '/',
    });

    return response;
  } catch {
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
