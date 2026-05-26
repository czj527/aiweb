'use client';

import Link from 'next/link';
import { ArrowLeft, Calendar, BookOpen, Tag } from 'lucide-react';

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

export function WeeklyListClient({ items }: WeeklyListClientProps) {
  return (
    <main className="max-w-5xl mx-auto px-8 py-8">
      {/* 面包屑 */}
      <div className="flex items-center gap-4 mb-8 border-b border-border/30 pb-6">
        <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
          <ArrowLeft className="w-4 h-4 inline mr-1 -mt-0.5" />首页
        </Link>
        <span className="text-border">|</span>
        <span className="text-xs text-muted-foreground font-semibold uppercase tracking-widest">
          每周深度摘要
        </span>
      </div>

      {/* 页面标题 */}
      <div className="mb-10">
        <h1 className="text-3xl font-bold font-display tracking-tight">
          📋 每周深度摘要
        </h1>
        <p className="text-muted-foreground text-sm mt-2">
          AI行业一周回顾，由AI Pulse自动生成
        </p>
      </div>

      {/* 周报列表 */}
      <div className="space-y-4">
        {items.map((item) => (
          <Link
            key={item.id}
            href={`/weekly/${item.id}`}
            className="block p-6 bg-card rounded-lg border border-border/30 hover:border-primary/30 hover:shadow-sm transition-all group"
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
