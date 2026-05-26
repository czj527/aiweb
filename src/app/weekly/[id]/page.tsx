import { getWeeklyDigest } from '@/lib/services/db-service';
import { WeeklyDetailClient } from '@/components/weekly-detail-client';
import { notFound } from 'next/navigation';

interface WeeklyDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function WeeklyDetailPage({ params }: WeeklyDetailPageProps) {
  const { id } = await params;
  const digest = await getWeeklyDigest(id);

  if (!digest) {
    notFound();
  }

  return <WeeklyDetailClient digest={digest} />;
}
