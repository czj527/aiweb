import { fetchRecentNews } from '@/lib/services/home-data';
import { HomeClient } from '@/components/home-client';

export const revalidate = 300;

export default async function HomePage() {
  const { days } = await fetchRecentNews(7);

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
