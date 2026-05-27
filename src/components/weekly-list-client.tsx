'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Calendar, BookOpen } from 'lucide-react';

interface WeeklyItem {
  id: string;
  week_start: string;
  week_end: string;
  title: string;
  summary: string;
  news_count: number;
  categories: string[];
  published_at: string;
}

interface WeeklyListClientProps {
  items: WeeklyItem[];
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

export function WeeklyListClient({ items: initialItems }: WeeklyListClientProps) {
  const [items, setItems] = useState<WeeklyItem[]>(initialItems);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // SSR数据为空时，客户端fetch API兜底
    if (initialItems.length === 0) {
      setLoading(true);
      fetch('/api/weekly')
        .then(res => res.json())
        .then(data => {
          if (data.items && data.items.length > 0) {
            setItems(data.items);
          }
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [initialItems.length]);

  if (loading) {
    return (
      <main className="max-w-5xl mx-auto px-8 py-8">
        <div className="flex flex-col items-center justify-center py-32 gap-4">
          <p className="text-muted-foreground">加载中...</p>
        </div>
      </main>
    );
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

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-8 py-8 page-enter">
      {/* 面包屑 */}
      <div className="flex items-center gap-4 mb-8 border-b border-border/30 pb-6 animate-stagger-fade">
        <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
          <ArrowLeft className="w-4 h-4 inline mr-1 -mt-0.5" />首页
        </Link>
        <span className="text-border">|</span>
        <span className="text-xs text-muted-foreground font-semibold uppercase tracking-widest">
          每周深度摘要
        </span>
      </div>

      {/* 页面标题 */}
      <div className="mb-10 animate-stagger-fade stagger-2">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-lg">📋</div>
          <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight">
            每周深度摘要
          </h1>
        </div>
        <p className="text-muted-foreground text-sm ml-[52px]">
          AI行业一周回顾，由AI Pulse自动生成
        </p>
      </div>

      {/* 周报列表 */}
      <div className="space-y-4">
        {items.map((item, i) => (
          <Link
            key={item.id}
            href={`/weekly/${item.id}`}
            className={`block p-6 bg-card rounded-xl border border-border/30 hover:border-primary/30 hover:shadow-float transition-all duration-300 group card-hover animate-stagger-fade stagger-${Math.min(i + 3, 8)}`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold font-display text-foreground group-hover:text-primary transition-colors">
                  {item.title}
                </h2>
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {formatDate(item.week_start)} ~ {formatDate(item.week_end)}
                  </span>
                  <span className="flex items-center gap-1">
                    <BookOpen className="w-3 h-3" />
                    {item.news_count} 条资讯
                  </span>
                </div>
                {item.summary && (
                  <p className="text-sm text-muted-foreground mt-3 line-clamp-2">
                    {item.summary}
                  </p>
                )}
                {item.categories && item.categories.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {item.categories.slice(0, 5).map((cat) => (
                      <span
                        key={cat}
                        className="px-2 py-0.5 text-[11px] font-medium bg-primary/8 text-primary rounded"
                      >
                        {cat}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
