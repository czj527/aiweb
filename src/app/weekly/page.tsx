import { getWeeklyDigestList } from '@/lib/services/db-service';
import { WeeklyListClient } from '@/components/weekly-list-client';

export const revalidate = 600;

export default async function WeeklyPage() {
  let items: Array<{
    id: string;
    week_start: string;
    week_end: string;
    title: string;
    summary: string;
    news_count: number;
    categories: string[];
    published_at: string;
  }> = [];

  try {
    items = await getWeeklyDigestList(20);
  } catch (e) {
    console.error('[weekly] Failed to load:', e);
  }

  if (items.length === 0) {
    return (
      <main className="max-w-5xl mx-auto px-8 py-8">
        <div className="flex flex-col items-center justify-center py-32 gap-4">
          <p className="text-muted-foreground">暂无周报数据</p>
          <p className="text-sm text-muted-foreground/60">每周日晚自动生成</p>
        </div>
      </main>
    );
  }

  return <WeeklyListClient items={items} />;
}
