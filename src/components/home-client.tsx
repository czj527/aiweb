'use client';

import Link from 'next/link';
import { useState, useCallback, useEffect, useRef } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import type { DayData } from '@/lib/services/home-data';

interface HomeClientProps {
  days: DayData[];
}

function isRSSData(days: DayData[]): boolean {
  return days.length > 0 && days[0].categories.some(c => c.items.some(i => i.id.startsWith('rss-')));
}

function isDataIncomplete(days: DayData[]): boolean {
  return days.some(d => d.categories.length === 0);
}

export function HomeClient({ days: initialDays }: HomeClientProps) {
  const [days, setDays] = useState<DayData[]>(initialDays);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fetched, setFetched] = useState(false);
  // Per-day animation state
  const [animatingDay, setAnimatingDay] = useState<Map<number, 'left' | 'right'>>(new Map());

  useEffect(() => {
    if (fetched) return;
    if (initialDays.length === 0 || isRSSData(initialDays) || isDataIncomplete(initialDays)) {
      fetchFromAPI();
    }
  }, [initialDays, fetched]);

  const fetchFromAPI = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/news/recent?days=7');
      const json = await res.json();
      if (json.success && json.data?.days?.length > 0) {
        setDays(json.data.days);
        setFetched(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const [activeCategoryByDay, setActiveCategoryByDay] = useState<Map<number, string>>(() => {
    const map = new Map<number, string>();
    days.forEach((day, idx) => {
      if (day.categories.length > 0) map.set(idx, day.categories[0].category);
    });
    return map;
  });

  const categoryIndexRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const indexMap = new Map<string, number>();
    days.forEach((day) => {
      day.categories.forEach((cat) => {
        if (!indexMap.has(cat.category)) {
          indexMap.set(cat.category, indexMap.size);
        }
      });
    });
    categoryIndexRef.current = indexMap;
  }, [days]);

  useEffect(() => {
    setActiveCategoryByDay((prev) => {
      const next = new Map(prev);
      days.forEach((day, idx) => {
        if (!next.has(idx) && day.categories.length > 0) next.set(idx, day.categories[0].category);
      });
      return next;
    });
  }, [days]);

  const handleCategorySwitch = useCallback((dayIndex: number, category: string) => {
    const oldCategory = activeCategoryByDay.get(dayIndex);
    const indexMap = categoryIndexRef.current;
    const oldIndex = oldCategory ? (indexMap.get(oldCategory) ?? 0) : 0;
    const newIndex = indexMap.get(category) ?? 0;
    const direction = newIndex > oldIndex ? 'left' : 'right';

    setAnimatingDay(new Map([[dayIndex, direction]]));

    setActiveCategoryByDay((prev) => {
      const next = new Map(prev);
      next.set(dayIndex, category);
      return next;
    });

    setTimeout(() => setAnimatingDay(new Map()), 800);
  }, [activeCategoryByDay]);

  if (loading) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col items-center justify-center py-32 gap-4">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-muted-foreground text-sm">正在加载资讯...</p>
        </div>
      </main>
    );
  }

  if (error && days.length === 0) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col items-center justify-center py-32 gap-4">
          <p className="text-muted-foreground">加载失败：{error}</p>
          <button onClick={fetchFromAPI} className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors">
            <RefreshCw className="w-4 h-4" /> 重新加载
          </button>
        </div>
      </main>
    );
  }

  if (days.length === 0) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col items-center justify-center py-32 gap-4">
          <p className="text-muted-foreground">暂无资讯数据</p>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 page-enter">
      {/* 每日资讯标题 */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold font-display text-foreground">每日资讯</h1>
        <p className="text-sm text-muted-foreground mt-1">AI领域最新动态，每日自动聚合更新</p>
      </div>

      <div className="flex flex-col gap-8">
        {days.map((day, dayIndex) => {
          const activeCategory = activeCategoryByDay.get(dayIndex) || day.categories[0]?.category || '';
          const activeGroup = day.categories.find((c) => c.category === activeCategory);
          const totalCount = day.categories.reduce((sum, c) => sum + c.count, 0);
          const dayAnimDir = animatingDay.get(dayIndex);

          return (
            <section
              key={day.date}
              className={`bg-card rounded-2xl shadow-card card-hover animate-stagger-fade stagger-${Math.min(dayIndex + 1, 8)}`}
            >
              <div className="px-6 pt-5 pb-3 flex items-center justify-between">
                <h2 className="font-display font-bold text-lg text-card-foreground">{day.dateLabel}</h2>
                <span className="text-xs text-muted-foreground">{totalCount} 条资讯</span>
              </div>
              {day.categories.length > 0 && (
                <div className="px-6 pb-3">
                  <div className="flex gap-2">
                    {day.categories.map((cat) => {
                      const isActive = cat.category === activeCategory;
                      const flexVal = Math.max((cat.count / totalCount) * 10, 1.5);
                      return (
                        <button key={cat.category} onClick={() => handleCategorySwitch(dayIndex, cat.category)}
                          className={`rounded-md px-4 py-2 text-sm text-center transition-all duration-200 ${isActive ? 'bg-primary text-primary-foreground font-medium' : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80'}`}
                          style={{ flex: flexVal }}>
                          {cat.category}<span className="ml-1 text-xs opacity-60">{cat.count}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="px-6 pb-5 overflow-hidden relative">
                {activeGroup && activeGroup.items.length > 0 && (
                  <div
                    key={activeCategory}
                    className={`grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4 ${
                      dayAnimDir
                        ? (dayAnimDir === 'left' ? 'page-flip-in-right' : 'page-flip-in-left')
                        : ''
                    }`}
                  >
                    {activeGroup.items.map((item) => (
                      <Link
                        key={item.id}
                        href={`/daily?date=${day.date}&highlight=${encodeURIComponent(item.title)}`}
                        className="group block border border-border/25 rounded-xl bg-muted/30 px-5 py-4 hover:border-primary/30 hover:bg-muted/50 transition-all duration-300 hover:shadow-float"
                      >
                        <h3 className="text-base font-medium text-card-foreground group-hover:text-primary transition-colors duration-200">{item.title}</h3>
                        <p className="text-xs text-muted-foreground/60 mt-1.5">{item.source}</p>
                        <p className="text-sm text-card-foreground/70 mt-2 leading-relaxed line-clamp-2">{item.summary}</p>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {/* 完整翻页动画 */}
      <style jsx global>{`
        @keyframes pageFlipInRight {
          0% { opacity: 0; transform: translateX(100%); }
          100% { opacity: 1; transform: translateX(0); }
        }
        @keyframes pageFlipInLeft {
          0% { opacity: 0; transform: translateX(-100%); }
          100% { opacity: 1; transform: translateX(0); }
        }
        .page-flip-in-right {
          animation: pageFlipInRight 1.2s cubic-bezier(0.22, 0.61, 0.36, 1) forwards;
        }
        .page-flip-in-left {
          animation: pageFlipInLeft 1.2s cubic-bezier(0.22, 0.61, 0.36, 1) forwards;
        }
      `}</style>
    </main>
  );
}
