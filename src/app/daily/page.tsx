import { Suspense } from 'react';
import { DailyContent } from '@/components/daily-client';
import { DailySkeleton } from '@/components/home-skeleton';

export const revalidate = 300;

async function fetchDailyReport(date?: string) {
  const baseUrl = process.env.SITE_URL || process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:5000';
  try {
    const url = date ? `${baseUrl}/api/daily?date=${date}` : `${baseUrl}/api/daily`;
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    const json = await res.json();
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}

async function fetchArchiveList() {
  const baseUrl = process.env.SITE_URL || process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:5000';
  try {
    const res = await fetch(`${baseUrl}/api/daily?list=true`, { next: { revalidate: 300 } });
    if (!res.ok) return [];
    const json = await res.json();
    return json.success ? json.data : [];
  } catch {
    return [];
  }
}

async function DailyPageContent({
  dateParam,
  highlight,
}: {
  dateParam?: string;
  highlight?: string;
}) {
  const [initialReport, initialArchive] = await Promise.all([
    fetchDailyReport(dateParam),
    fetchArchiveList(),
  ]);

  return (
    <DailyContent
      initialReport={initialReport}
      initialArchive={initialArchive}
      initialDate={dateParam || null}
      highlight={highlight || null}
    />
  );
}

export default async function DailyPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; highlight?: string }>;
}) {
  const params = await searchParams;
  const dateParam = params.date;
  const highlight = params.highlight;

  return (
    <Suspense fallback={<DailySkeleton />}>
      <DailyPageContent dateParam={dateParam} highlight={highlight} />
    </Suspense>
  );
}
