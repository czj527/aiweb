'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Calendar, BookOpen } from 'lucide-react';

interface WeeklyDigest {
  id: string;
  week_start: string;
  week_end: string;
  title: string;
  summary: string;
  hot_topics: string[];
  news_count: number;
  categories: string[];
  content: string;
  published_at: string;
}

interface WeeklyDetailClientProps {
  digest: WeeklyDigest | null;
  id: string;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 星期${weekdays[d.getDay()]}`;
}

function renderMarkdown(content: string): string {
  return content
    .replace(/^### (.+)$/gm, '<h3 class="text-lg font-bold font-display text-foreground mt-8 mb-3 tracking-tight">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold font-display text-foreground mt-10 mb-4 tracking-tight border-b border-border/30 pb-3">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-3xl font-bold font-display text-foreground mb-6 tracking-tight">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>')
    .replace(/^- (.+)$/gm, '<li class="text-[15px] text-foreground/85 leading-[1.85] mb-1 ml-4">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="text-[15px] text-foreground/85 leading-[1.85] mb-1 ml-4">$1. $2</li>')
    .replace(/^> (.+)$/gm, '<blockquote class="border-l-4 border-primary/30 pl-4 py-2 my-4 bg-primary/5 rounded-r-lg italic text-foreground/80">$1</blockquote>')
    .replace(/^---$/gm, '<hr class="border-border/30 my-8" />')
    .replace(/\n\n/g, '</p><p class="text-[15px] text-foreground/85 leading-[1.85] mb-3">')
    .replace(/\n/g, '<br/>');
}

export function WeeklyDetailClient({ digest: initialDigest, id }: WeeklyDetailClientProps) {
  const [digest, setDigest] = useState<WeeklyDigest | null>(initialDigest);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    // SSR数据为空时，客户端fetch API兜底
    if (!initialDigest) {
      setLoading(true);
      fetch(`/api/weekly/${id}`)
        .then(res => {
          if (!res.ok) throw new Error('Not found');
          return res.json();
        })
        .then(data => {
          if (data) setDigest(data);
          else setNotFound(true);
        })
        .catch(() => setNotFound(true))
        .finally(() => setLoading(false));
    }
  }, [initialDigest, id]);

  if (loading) {
    return (
      <main className="max-w-5xl mx-auto px-8 py-8">
        <div className="flex flex-col items-center justify-center py-32 gap-4">
          <p className="text-muted-foreground">加载中...</p>
        </div>
      </main>
    );
  }

  if (notFound || !digest) {
    return (
      <main className="max-w-5xl mx-auto px-8 py-8">
        <div className="flex flex-col items-center justify-center py-32 gap-4">
          <p className="text-muted-foreground">周报不存在</p>
          <Link href="/weekly" className="text-primary hover:underline text-sm">返回周报列表</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-5xl mx-auto px-8 py-8">
      {/* 面包屑 */}
      <div className="flex items-center gap-4 mb-8 border-b border-border/30 pb-6">
        <Link href="/weekly" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
          <ArrowLeft className="w-4 h-4 inline mr-1 -mt-0.5" />周报列表
        </Link>
        <span className="text-border">|</span>
        <span className="text-xs text-muted-foreground font-semibold uppercase tracking-widest">
          每周深度摘要
        </span>
      </div>

      {/* 文章头部 */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold font-display tracking-tight">
          {digest.title}
        </h1>
        <div className="flex items-center gap-3 mt-3">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="w-3 h-3" />
            {formatDate(digest.week_start)} ~ {formatDate(digest.week_end)}
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <BookOpen className="w-3 h-3" />
            {digest.news_count} 条资讯
          </span>
        </div>
        {digest.hot_topics && digest.hot_topics.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-4">
            {digest.hot_topics.map((topic) => (
              <span key={topic} className="px-2 py-0.5 text-[11px] font-medium bg-primary/8 text-primary rounded">
                #{topic}
              </span>
            ))}
          </div>
        )}
      </header>

      {/* 正文 */}
      {digest.content && (
        <article
          className="prose-custom"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(digest.content) }}
        />
      )}

      {/* 摘要（如有） */}
      {digest.summary && !digest.content && (
        <div className="p-6 bg-surface-container rounded-lg">
          <p className="text-foreground/85 leading-relaxed">{digest.summary}</p>
        </div>
      )}
    </main>
  );
}
