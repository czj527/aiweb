import { Metadata } from 'next';
import { ToolsClient } from './tools-client';

export const revalidate = 60;

export const metadata: Metadata = {
  title: 'AI 工具推荐 - AI Pulse',
  description: '精选 AI 开发工具与项目推荐',
};

// 获取初始数据用于SSR
async function getInitialTools() {
  const SUPABASE_URL = process.env.SUPABASE_URL || '';
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!SUPABASE_URL || !SUPABASE_KEY) return [];

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/ai_tools?select=*&order=is_featured.desc,sort_order.asc,created_at.desc`,
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

export default async function ToolsPage() {
  const initialTools = await getInitialTools();
  return <ToolsClient initialTools={initialTools} />;
}
