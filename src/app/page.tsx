import { Suspense } from 'react';
import { fetchRecentNews } from '@/lib/services/home-data';
import { HomeClient } from '@/components/home-client';
import { HomeSkeleton } from '@/components/home-skeleton';

export const revalidate = 120;

async function HomeContent() {
  const { days } = await fetchRecentNews();

  if (days.length === 0) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col items-center justify-center py-32 gap-4">
          <p className="text-muted-foreground">暂无资讯数据</p>
          <p className="text-sm text-muted-foreground/60">每日 7:00 自动更新，请稍后再来</p>
        </div>
      </main>
    );
  }

  return <HomeClient days={days} />;
}

export default function HomePage() {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <HomeContent />
    </Suspense>
  );
}
