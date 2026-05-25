'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/navbar';
import { Loader2, RefreshCw } from 'lucide-react';

interface NewsItem {
  id: string;
  title: string;
  source: string;
  sourceUrl: string;
  summary: string;
  publishedAt: string;
}

interface CategoryGroup {
  category: string;
  count: number;
  items: NewsItem[];
}

interface DayData {
  date: string;
  dateLabel: string;
  categories: CategoryGroup[];
  totalCount?: number;
}

/** 橘鸦8大分类 */
const JUYA_CATEGORIES = [
  '要闻',
  '模型发布',
  '开发生态',
  '产品应用',
  '技术与洞察',
  '行业动态',
  '政策与治理',
  '前瞻与传闻',
];

type LoadingState = 'loading' | 'success' | 'error';

export default function HomePage() {
  const [days, setDays] = useState<DayData[]>([]);
  const [loadingState, setLoadingState] = useState<LoadingState>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [isFallback, setIsFallback] = useState(false);

  const fetchData = useCallback(async () => {
    setLoadingState('loading');
    setErrorMsg('');
    setIsFallback(false);

    try {
      // 优先从 Supabase 数据库查询
      const res = await fetch('/api/news/recent?days=7');
      const json = await res.json();

      if (json.success && json.data?.days?.length > 0) {
        setDays(json.data.days);
        setLoadingState('success');
        return;
      }

      // 数据库无数据，降级到橘鸦 RSS 实时拉取
      console.log('[HomePage] No DB data, falling back to RSS');
      setIsFallback(true);

      const rssRes = await fetch('/api/juya/news');
      const rssJson = await rssRes.json();

      if (rssJson.success && rssJson.data?.categories?.length > 0) {
        // 将 RSS 分类数据转为 DayData 格式（只有当天）
        const today = new Date();
        const month = today.getMonth() + 1;
        const date = today.getDate();
        const dateLabel = `今天 · ${month}月${date}日`;
        const dateStr = today.toISOString().split('T')[0];

        const categories: CategoryGroup[] = rssJson.data.categories.map(
          (cat: { category: string; items: Array<{ title: string; url: string; snippet: string; quote?: string; order?: number }> }) => ({
            category: cat.category,
            count: cat.items.length,
            items: cat.items.map((item, idx: number) => ({
              id: `rss-${cat.category}-${idx}`,
              title: item.title,
              source: '橘鸦AI早报',
              sourceUrl: item.url || '#',
              summary: item.quote || item.snippet || '',
              publishedAt: dateStr,
            })),
          })
        );

        setDays([{ date: dateStr, dateLabel, categories }]);
        setLoadingState('success');
      } else {
        setDays([]);
        setLoadingState('success');
      }
    } catch (e) {
      console.error('[HomePage] Fetch error:', e);
      setErrorMsg(e instanceof Error ? e.message : '加载失败');
      setLoadingState('error');
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 每个 day 卡片的活跃分类状态
  const [activeCategoryByDay, setActiveCategoryByDay] = useState<Map<number, string>>(() => {
    const map = new Map<number, string>();
    days.forEach((day, idx) => {
      if (day.categories.length > 0) {
        map.set(idx, day.categories[0].category);
      }
    });
    return map;
  });

  // 当 days 变化时更新默认选中
  useEffect(() => {
    setActiveCategoryByDay((prev) => {
      const next = new Map(prev);
      days.forEach((day, idx) => {
        if (!next.has(idx) && day.categories.length > 0) {
          next.set(idx, day.categories[0].category);
        }
      });
      return next;
    });
  }, [days]);

  const handleCategorySwitch = useCallback((dayIndex: number, category: string) => {
    setActiveCategoryByDay((prev) => {
      const next = new Map(prev);
      next.set(dayIndex, category);
      return next;
    });
  }, []);

  // Loading 状态
  if (loadingState === 'loading') {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-muted-foreground text-sm">正在加载资讯...</p>
          </div>
        </main>
      </div>
    );
  }

  // 错误状态
  if (loadingState === 'error') {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <p className="text-muted-foreground">加载失败：{errorMsg}</p>
            <button
              onClick={fetchData}
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              重新加载
            </button>
          </div>
        </main>
      </div>
    );
  }

  // 空数据状态
  if (days.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <p className="text-muted-foreground">暂无资讯数据</p>
            <button
              onClick={fetchData}
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              刷新
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isFallback && (
          <div className="mb-4 px-4 py-2 rounded-md bg-muted text-muted-foreground text-xs text-center">
            数据库暂无缓存，当前展示橘鸦RSS实时数据
          </div>
        )}
        <div className="flex flex-col gap-8">
          {days.map((day, dayIndex) => {
            const activeCategory = activeCategoryByDay.get(dayIndex) || day.categories[0]?.category || '';
            const activeGroup = day.categories.find((c) => c.category === activeCategory);
            const totalCount = day.categories.reduce((sum, c) => sum + c.count, 0);

            return (
              <section
                key={day.date}
                className="bg-card rounded-lg shadow-card"
              >
                {/* 日期标题 */}
                <div className="px-6 pt-5 pb-3">
                  <h2 className="font-display font-bold text-lg text-card-foreground">
                    {day.dateLabel}
                  </h2>
                </div>

                {/* 分类标签栏 */}
                {day.categories.length > 0 && (
                  <div className="px-6 pb-3">
                    <div className="flex gap-2">
                      {day.categories.map((cat) => {
                        const isActive = cat.category === activeCategory;
                        const flexVal = Math.max((cat.count / totalCount) * 10, 1.5);
                        return (
                          <button
                            key={cat.category}
                            onClick={() => handleCategorySwitch(dayIndex, cat.category)}
                            className={`rounded-md px-4 py-2 text-sm text-center transition-all duration-200 ${
                              isActive
                                ? 'bg-primary text-primary-foreground font-medium'
                                : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80'
                            }`}
                            style={{ flex: flexVal }}
                          >
                            {cat.category}
                            <span className="ml-1 text-xs opacity-60">{cat.count}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 资讯网格 */}
                <div className="px-6 pb-5">
                  {activeGroup && activeGroup.items.length > 0 && (
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
                      {activeGroup.items.map((item) => (
                        <Link
                          key={item.id}
                          href={`/daily?date=${day.date}&highlight=${encodeURIComponent(item.title)}`}
                          className="block border border-border/25 rounded-md bg-muted/50 px-5 py-4 hover:border-primary/40 hover:shadow-float transition-all duration-200"
                        >
                          <h3 className="text-base font-medium text-card-foreground">
                            {item.title}
                          </h3>
                          <p className="text-xs text-muted-foreground mt-2">
                            {item.source}
                          </p>
                          <p className="text-sm text-card-foreground/70 mt-2 leading-relaxed line-clamp-2">
                            {item.summary}
                          </p>
                        </Link>
                      ))}
                    </div>
                  )}
                  {activeGroup && activeGroup.items.length === 0 && (
                    <p className="text-muted-foreground text-sm py-8 text-center">该分类暂无资讯</p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </main>
    </div>
  );
}


