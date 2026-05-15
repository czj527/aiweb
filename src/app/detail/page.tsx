'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/navbar';
import { getNewsDetail, categoryConfig, type NewsDetailResponse } from '@/lib/api-client';
import {
  ChevronRight,
  Sparkles,
  ExternalLink,
  ArrowLeft,
  Clock,
  Tag,
  BookOpen,
} from 'lucide-react';

export default function DetailPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = use(searchParams);
  const [news, setNews] = useState<NewsDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [relatedNews, setRelatedNews] = useState<NewsDetailResponse[]>([]);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    async function loadNews() {
      setLoading(true);
      try {
        const data = await getNewsDetail(id as string);
        setNews(data);

        // 加载相关新闻
        if (data.relatedIds && data.relatedIds.length > 0) {
          const related = await Promise.all(
            data.relatedIds.slice(0, 3).map((rid) =>
              getNewsDetail(rid).catch(() => null)
            )
          );
          setRelatedNews(related.filter((r): r is NewsDetailResponse => r !== null));
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    loadNews();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background font-sans">
        <Navbar />
        <main className="max-w-5xl mx-auto px-6 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-40" />
            <div className="h-8 bg-muted rounded w-3/4" />
            <div className="h-20 bg-muted rounded" />
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-4 bg-muted rounded" />
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!news) {
    return (
      <div className="min-h-screen bg-background font-sans">
        <Navbar />
        <main className="max-w-5xl mx-auto px-6 py-8">
          <div className="text-center py-20">
            <BookOpen className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-foreground mb-2">
              新闻未找到
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              该新闻可能已被删除或链接无效
            </p>
            <Link
              href="/"
              className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors inline-flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              返回AI日报
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const estimateReadTime = (text: string) => {
    const chars = text.length;
    return Math.max(2, Math.ceil(chars / 500));
  };

  return (
    <div className="min-h-screen bg-background font-sans">
      <Navbar />
      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* 面包屑 */}
        <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-6">
          <Link href="/" className="hover:text-primary transition-colors">
            AI日报
          </Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-primary/80">
            {categoryConfig[news.category]?.label || news.category}
          </span>
          <ChevronRight className="w-3 h-3" />
          <span className="text-foreground/60 truncate max-w-48">
            {news.title}
          </span>
        </nav>

        {/* 标题区 */}
        <header className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold font-display tracking-tight leading-tight mb-3">
            {news.title}
          </h1>
          <div className="flex items-center flex-wrap gap-3">
            {news.category && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-primary/80 bg-primary/8 px-2.5 py-1 rounded-full">
                <Tag className="w-3 h-3" />
                {categoryConfig[news.category]?.label || news.category}
              </span>
            )}
            <span className="text-xs text-muted-foreground">{news.source}</span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              {formatDate(news.publishedAt)}
            </span>
            {news.aiDetail && (
              <span className="text-xs text-muted-foreground">
                约{estimateReadTime(news.aiDetail)}分钟阅读
              </span>
            )}
          </div>
        </header>

        {/* AI 摘要卡片 */}
        <div className="mb-8 p-5 bg-primary/[0.03] border-l-3 border-primary rounded-r-lg">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">
              AI 摘要
            </span>
          </div>
          <p className="text-sm leading-relaxed text-foreground/90">
            {news.summary}
          </p>
          <p className="text-[10px] text-muted-foreground/50 mt-3">
            由AI自动生成，仅供参考
          </p>
        </div>

        {/* 正文 */}
        {news.aiDetail && (
          <article className="mb-10 prose-sm">
            {news.aiDetail.split('\n\n').map((para, i) => (
              <p
                key={i}
                className="text-sm leading-[1.9] text-foreground/85 mb-4"
              >
                {para}
              </p>
            ))}
          </article>
        )}

        {/* 原文链接 */}
        {news.sourceUrl && (
          <div className="mb-8">
            <a
              href={news.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              阅读原文
            </a>
          </div>
        )}

        {/* 多源视角 */}
        {news.multiSourceViews && news.multiSourceViews.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <span className="w-1 h-4 bg-primary rounded-full" />
              多源视角
            </h2>
            <div className="space-y-3">
              {news.multiSourceViews.map((view, i) => (
                <div
                  key={i}
                  className="p-4 bg-muted/40 rounded-lg border border-border/20"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-semibold text-foreground">
                      {view.source}
                    </span>
                  </div>
                  <h4 className="text-sm font-medium text-foreground/90 mb-1">
                    {view.title}
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {view.summary}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 相关推荐 */}
        {relatedNews.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <span className="w-1 h-4 bg-primary rounded-full" />
              相关推荐
            </h2>
            <div className="space-y-3">
              {relatedNews.map((related) => (
                <Link
                  key={related.id}
                  href={`/detail?id=${related.id}`}
                  className="block p-4 bg-card rounded-lg border border-border/30 hover:border-primary/30 hover:shadow-sm transition-all group"
                >
                  <h4 className="text-sm font-medium text-foreground group-hover:text-primary transition-colors mb-1.5">
                    {related.title}
                  </h4>
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center text-[10px] font-medium text-primary/80 bg-primary/8 px-2 py-0.5 rounded">
                      {categoryConfig[related.category]?.label || related.category}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {related.source}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatDate(related.publishedAt)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* 返回按钮 */}
        <div className="pt-4 border-t border-border/20">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            返回AI日报
          </Link>
        </div>
      </main>
    </div>
  );
}
