import { Suspense } from 'react';
import { DailyContent } from '@/components/daily-client';

export const revalidate = 300; // 5分钟 ISR

async function fetchDailyReport(date?: string) {
  const baseUrl = process.env.SITE_URL || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:5000';
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
  const baseUrl = process.env.SITE_URL || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:5000';
  try {
    const res = await fetch(`${baseUrl}/api/daily?list=true`, { next: { revalidate: 300 } });
    if (!res.ok) return [];
    const json = await res.json();
    return json.success ? json.data : [];
  } catch {
    return [];
  }
}

export default async function DailyPage({ searchParams }: { searchParams: Promise<{ date?: string; highlight?: string }> }) {
  const params = await searchParams;
  const dateParam = params.date;
  const highlight = params.highlight;

  // SSR 预取初始数据
  const [initialReport, initialArchive] = await Promise.all([
    fetchDailyReport(dateParam),
    fetchArchiveList(),
  ]);

  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><p className="text-muted-foreground">加载中...</p></div>}>
      <DailyContent
        initialReport={initialReport}
        initialArchive={initialArchive}
        initialDate={dateParam || null}
        highlight={highlight || null}
      />
    </Suspense>
  );
}
