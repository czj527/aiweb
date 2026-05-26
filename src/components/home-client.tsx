'use client';

import Link from 'next/link';
import { useState, useCallback, useEffect } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import type { DayData } from '@/lib/services/home-data';

interface HomeClientProps {
  days: DayData[];
}

function isRSSData(days: DayData[]): boolean {
  return days.length > 0 && days[0].categories.some(c => c.items.some(i => i.id.startsWith('rss-')));
}

function isDataIncomplete(days: DayData[]): boolean {
  // SSR数据看起来有天数但分类为空，说明ISR缓存了旧渲染
  return days.some(d => d.categories.length === 0);
}

export function HomeClient({ days: initialDays }: HomeClientProps) {
  const [days, setDays] = useState<DayData[]>(initialDays);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fetched, setFetched] = useState(false);

  // SSR 数据不完整时（空、RSS降级、或ISR缓存了空数据），客户端 fetch API 拿本周完整数据
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
    setActiveCategoryByDay((prev) => { const next = new Map(prev); next.set(dayIndex, category); return next; });
  }, []);

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
          <button onClick={fetchFromAPI} className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90">
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
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col gap-8">
        {days.map((day, dayIndex) => {
          const activeCategory = activeCategoryByDay.get(dayIndex) || day.categories[0]?.category || '';
          const activeGroup = day.categories.find((c) => c.category === activeCategory);
          const totalCount = day.categories.reduce((sum, c) => sum + c.count, 0);

          return (
            <section key={day.date} className="bg-card rounded-lg shadow-card">
              <div className="px-6 pt-5 pb-3">
                <h2 className="font-display font-bold text-lg text-card-foreground">{day.dateLabel}</h2>
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
              <div className="px-6 pb-5">
                {activeGroup && activeGroup.items.length > 0 && (
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
                    {activeGroup.items.map((item) => (
                      <Link key={item.id} href={`/daily?date=${day.date}&highlight=${encodeURIComponent(item.title)}`}
                        className="block border border-border/25 rounded-md bg-muted/50 px-5 py-4 hover:border-primary/40 hover:shadow-float transition-all duration-200">
                        <h3 className="text-base font-medium text-card-foreground">{item.title}</h3>
                        <p className="text-xs text-muted-foreground mt-2">{item.source}</p>
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
    </main>
  );
}
