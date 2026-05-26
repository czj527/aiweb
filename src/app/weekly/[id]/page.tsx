import { getWeeklyDigest } from '@/lib/services/db-service';
import { WeeklyDetailClient } from '@/components/weekly-detail-client';
import { notFound } from 'next/navigation';

interface WeeklyDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function WeeklyDetailPage({ params }: WeeklyDetailPageProps) {
  const { id } = await params;
  let digest = null;
  try {
    digest = await getWeeklyDigest(id);
  } catch (e) {
    console.error('[weekly-detail] Failed to load:', e);
  }

  if (!digest) {
    // 不直接notFound，让客户端组件尝试fetch兜底
    return <WeeklyDetailClient digest={null} id={id} />;
  }

  return <WeeklyDetailClient digest={digest} id={id} />;
}
