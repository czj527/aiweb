import { HomeClient } from '@/components/home-client';

export const revalidate = 300; // 5分钟 ISR

async function fetchHomeData(days: number = 7) {
  const baseUrl = process.env.SITE_URL || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:5000';
  
  try {
    const res = await fetch(`${baseUrl}/api/news/recent?days=${days}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error(`API returned ${res.status}`);
    const json = await res.json();
    if (json.success && json.data?.days?.length > 0) {
      return { days: json.data.days };
    }
  } catch (e) {
    console.warn('[HomePage] API fetch failed:', e instanceof Error ? e.message : e);
  }

  return { days: [] };
}

export default async function HomePage() {
  const { days } = await fetchHomeData(7);

  if (days.length === 0) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col items-center justify-center py-32 gap-4">
          <p className="text-muted-foreground">暂无资讯数据</p>
        </div>
      </main>
    );
  }

  return <HomeClient days={days} />;
}
