import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const revalidate = 3600;

export interface Milestone {
  id: string;
  date: string;
  title: string;
  description: string | null;
  category: 'breakthrough' | 'model' | 'product' | 'opensource' | 'event' | 'regulation';
  importance: number;
  link_url: string | null;
  created_at: string;
  updated_at: string;
}

export async function generateMetadata() {
  return {
    title: 'AI 发展时间线 | AI Pulse',
    description: 'AI 技术发展里程碑，从 Transformer 到 Agent 的演进历程',
  };
}

export default async function TimelinePage() {
  // 服务端获取里程碑数据
  const { data: milestones, error } = await supabase
    .from('ai_milestones')
    .select('*')
    .order('date', { ascending: true });

  if (error || !milestones) {
    console.error('Failed to fetch milestones:', error);
  }

  // 客户端组件
  const { TimelineClient } = await import('./timeline-client');

  return (
    <main className="min-h-screen bg-background">
      <TimelineClient initialMilestones={milestones || []} />
    </main>
  );
}
