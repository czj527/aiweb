import { Metadata } from 'next';
import { RadioClient } from './radio-client';

export const revalidate = 60;

export const metadata: Metadata = {
  title: 'AI 电台 - AI Pulse',
  description: '复古收音机风格的 AI 资讯语音播报',
};

// 获取初始数据用于SSR
async function getInitialBroadcasts() {
  const SUPABASE_URL = process.env.SUPABASE_URL || '';
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!SUPABASE_URL || !SUPABASE_KEY) return [];

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/radio_broadcasts?select=*&order=date.desc,created_at.desc&limit=20`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
        next: { revalidate: 60 },
      }
    );
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export default async function RadioPage() {
  const initialBroadcasts = await getInitialBroadcasts();
  return (
    <main className="min-h-screen">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 text-sm text-amber-800 flex items-center gap-2">
          <span className="text-lg">🚧</span>
          <span>电台功能正在施工中，音频内容和交互将持续完善</span>
        </div>
      </div>
      <RadioClient initialBroadcasts={initialBroadcasts} />
    </main>
  );
}
