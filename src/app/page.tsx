'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/navbar';
import { ArrowRight } from 'lucide-react';

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
  totalCount: number;
}

interface RecentNewsResponse {
  success: boolean;
  data: {
    days: DayData[];
    fetchedAt: string;
  };
}

export default function HomePage() {
  const [days, setDays] = useState<DayData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // 每个卡片的当前激活分类：dayIndex -> category
  const [activeCategoryByDay, setActiveCategoryByDay] = useState<Map<number, string>>(new Map());
  // 每个卡片的切换动画状态
  const [switchingDay, setSwitchingDay] = useState<number | null>(null);

  useEffect(() => {
    async function loadNews() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/news/recent?days=7');
        const json: RecentNewsResponse = await res.json();
        if (json.success) {
          setDays(json.data.days);
          // 默认每个卡片选中第一个分类（资讯最多的）
          const initialActive = new Map<number, string>();
          json.data.days.forEach((day, idx) => {
            if (day.categories.length > 0) {
              initialActive.set(idx, day.categories[0].category);
            }
          });
          setActiveCategoryByDay(initialActive);
        } else {
          setError('获取资讯失败');
        }
      } catch (e) {
        setError('网络请求失败');
      } finally {
        setLoading(false);
      }
    }
    loadNews();
  }, []);

  const handleTabSwitch = useCallback((dayIndex: number, category: string) => {
    setSwitchingDay(dayIndex);
    setTimeout(() => {
      setActiveCategoryByDay(prev => {
        const next = new Map(prev);
        next.set(dayIndex, category);
        return next;
      });
      setSwitchingDay(null);
    }, 150);
  }, []);

  // Loading skeleton
  if (loading) {
    return (
      <div className="min-h-screen bg-background font-sans">
        <Navbar />
        <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          <div className="animate-pulse space-y-8">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-card rounded-lg shadow-card p-6 space-y-4">
                <div className="h-6 bg-muted rounded w-40" />
                <div className="flex gap-2">
                  {[1, 2, 3, 4].map(j => (
                    <div key={j} className="h-9 bg-muted rounded-md flex-1" />
                  ))}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[1, 2, 3, 4].map(j => (
                    <div key={j} className="h-28 bg-muted rounded-md" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  const totalNews = days.reduce((sum, d) => sum + d.totalCount, 0);

  return (
    <div className="min-h-screen bg-background font-sans">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold font-display tracking-tight text-foreground">
              橘鸦AI早报
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              共 {totalNews} 条资讯 · {days.length} 天
            </p>
          </div>
          <Link
            href="/daily"
            className="text-sm text-primary hover:underline flex items-center gap-1 shrink-0"
          >
            查看图文日报
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {error ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-sm mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="text-primary text-sm hover:underline"
            >
              重试
            </button>
          </div>
        ) : days.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-sm">暂无资讯</p>
          </div>
        ) : (
          <div className="space-y-8">
            {days.map((day, dayIndex) => {
              const activeCategory = activeCategoryByDay.get(dayIndex) || day.categories[0]?.category;
              const activeCategoryData = day.categories.find(c => c.category === activeCategory);
              const isSwitching = switchingDay === dayIndex;

              // 计算分类标签的 flex 比例
              const totalItems = day.categories.reduce((s, c) => s + c.count, 0);

              return (
                <section
                  key={day.date}
                  className="bg-card rounded-lg shadow-card overflow-hidden"
                >
                  {/* 日期标题 */}
                  <div className="px-6 pt-5 pb-3 flex items-center justify-between">
                    <h2 className="font-display font-bold text-lg text-card-foreground">
                      {day.dateLabel}
                    </h2>
                    <span className="text-xs text-muted-foreground">
                      {day.totalCount} 条
                    </span>
                  </div>

                  {/* 分类标签栏 */}
                  {day.categories.length > 0 && (
                    <div className="px-6 pb-3">
                      <div className="flex gap-2">
                        {day.categories.map(cat => {
                          const isActive = cat.category === activeCategory;
                          const flexRatio = totalItems > 0
                            ? Math.max(1, Math.round((cat.count / totalItems) * 24))
                            : 1;
                          return (
                            <button
                              key={cat.category}
                              onClick={() => handleTabSwitch(dayIndex, cat.category)}
                              style={{ flex: flexRatio }}
                              className={`rounded-md px-3 py-2 text-sm text-center transition-all duration-150 cursor-pointer ${
                                isActive
                                  ? 'bg-primary text-primary-foreground font-medium'
                                  : 'bg-muted text-muted-foreground hover:text-foreground'
                              }`}
                            >
                              {cat.category}
                              <span className={`ml-1 text-xs ${isActive ? 'text-primary-foreground/70' : 'text-muted-foreground/60'}`}>
                                {cat.count}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* 资讯网格 */}
                  <div className={`px-6 pb-5 transition-opacity duration-150 ${isSwitching ? 'opacity-0' : 'opacity-100'}`}>
                    {activeCategoryData && activeCategoryData.items.length > 0 ? (
                      <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
                        {activeCategoryData.items.map((item, itemIdx) => (
                          <Link
                            key={`${day.date}-${item.id}-${itemIdx}`}
                            href={`/daily?date=${day.date}`}
                            className="block border border-border/25 rounded-md bg-surface-container-lowest px-5 py-4 hover:border-primary/40 hover:shadow-float transition-all duration-200"
                          >
                            <h3 className="text-base font-medium text-card-foreground font-sans line-clamp-2">
                              {item.title}
                            </h3>
                            <p className="text-xs text-muted-foreground mt-2">
                              {item.source} · {new Date(item.publishedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            {item.summary && (
                              <p className="text-sm text-muted-foreground/80 mt-2 leading-relaxed line-clamp-2">
                                {item.summary}
                              </p>
                            )}
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        该分类暂无资讯
                      </div>
                    )}
                  </div>

                  {/* 底部：查看日报 */}
                  <div className="px-6 pb-5">
                    <div className="border-t border-border/20 pt-4">
                      <Link
                        href={`/daily?date=${day.date}`}
                        className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
                      >
                        查看完整日报
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
