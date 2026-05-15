'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/navbar';
import { categoryConfig, type NewsItemResponse } from '@/lib/api-client';
import { Clock, Flame, ArrowRight, Hash } from 'lucide-react';

interface HotData {
  hours: number;
  totalCount: number;
  news: NewsItemResponse[];
}

export default function HomePage() {
  const [hotData, setHotData] = useState<HotData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadHot() {
      setLoading(true);
      try {
        const res = await fetch('/api/hot?hours=24&limit=10');
        const json = await res.json();
        if (json.success) {
          setHotData(json.data);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    loadHot();
  }, []);

  const news = hotData?.news || [];
  const totalCount = hotData?.totalCount || 0;

  const hotKeywords = Array.from(
    new Set(news.flatMap((n) => n.keywords || []))
  ).slice(0, 6);

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const importanceLabel = (score: number) => {
    if (score >= 15) return { text: '重磅', cls: 'bg-red-500/10 text-red-600' };
    if (score >= 12) return { text: '重要', cls: 'bg-amber-500/10 text-amber-600' };
    if (score >= 8) return { text: '关注', cls: 'bg-primary/8 text-primary' };
    return null;
  };

  // 加载态
  if (loading) {
    return (
      <div className="min-h-screen bg-background font-sans">
        <Navbar />
        <main className="max-w-6xl mx-auto px-6 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-10 bg-muted rounded w-64" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-48 bg-muted rounded-lg" />
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background font-sans">
      <Navbar />
      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* 标题区 */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold font-display tracking-tight flex items-center gap-2">
              <Flame className="w-7 h-7 text-primary" />
              今日热点资讯
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              过去 24 小时 AI 领域最重要的 {news.length} 条新闻
            </p>
          </div>
          {totalCount > news.length && (
            <Link
              href="/news"
              className="text-sm text-primary hover:underline flex items-center gap-1 shrink-0"
            >
              全部 {totalCount} 条
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>

        {news.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-sm mb-4">暂无热点资讯</p>
            <Link href="/news" className="text-primary text-sm hover:underline">
              查看全部资讯 →
            </Link>
          </div>
        ) : (
          <div className="flex gap-6">
            {/* 主栏：所有新闻卡片 */}
            <div className="flex-1 min-w-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {news.map((item, idx) => {
                  const badge = importanceLabel(item.importanceScore);
                  const isTop3 = idx < 3;
                  return (
                    <Link
                      key={item.id}
                      href={`/detail?id=${item.id}`}
                      className={`group block bg-card rounded-lg border border-border/40 hover:border-primary/40 hover:shadow-md transition-all overflow-hidden ${
                        isTop3 && idx === 0 ? 'md:col-span-2' : ''
                      }`}
                    >
                      {/* 卡片顶部色条 */}
                      <div className={`h-1.5 ${isTop3 ? 'bg-gradient-to-r from-primary/70 to-primary/20' : 'bg-gradient-to-r from-primary/40 to-primary/10'}`} />
                      <div className={isTop3 ? 'p-6' : 'p-5'}>
                        {/* 排名 + 标签 */}
                        <div className="flex items-center justify-between mb-3">
                          <span className={`font-bold text-primary/15 font-display leading-none ${isTop3 ? 'text-4xl' : 'text-3xl'}`}>
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {badge && (
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${badge.cls}`}>
                                {badge.text}
                              </span>
                            )}
                            <span className="text-[10px] font-medium text-primary/80 bg-primary/8 px-2 py-0.5 rounded">
                              {categoryConfig[item.category]?.label || item.category}
                            </span>
                          </div>
                        </div>
                        {/* 标题 */}
                        <h2 className={`font-bold font-display text-foreground group-hover:text-primary transition-colors leading-snug mb-3 ${
                          isTop3 && idx === 0 ? 'text-xl line-clamp-2 min-h-[3.2em]' : 'text-base line-clamp-2 min-h-[2.8em]'
                        }`}>
                          {item.title}
                        </h2>
                        {/* 摘要 */}
                        <p className={`text-muted-foreground leading-relaxed mb-4 ${
                          isTop3 && idx === 0 ? 'text-sm line-clamp-4' : 'text-sm line-clamp-3'
                        }`}>
                          {item.summary}
                        </p>
                        {/* 元信息 */}
                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                          <span>{item.source}</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatTime(item.publishedAt)}
                          </span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
              {/* 查看全部 */}
              <div className="mt-8 text-center">
                <Link
                  href="/news"
                  className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-primary bg-primary/8 hover:bg-primary/15 rounded-lg transition-colors"
                >
                  查看全部资讯
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* 右栏 侧边信息 */}
            <aside className="w-52 shrink-0 hidden lg:block space-y-6">
              {hotKeywords.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    热门话题
                  </h3>
                  <div className="space-y-2">
                    {hotKeywords.map((topic) => (
                      <div
                        key={topic}
                        className="flex items-center gap-2 text-sm text-foreground/80 hover:text-primary cursor-pointer transition-colors"
                      >
                        <Hash className="w-3.5 h-3.5 text-muted-foreground" />
                        {topic}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 快捷入口 */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  导航
                </h3>
                <div className="space-y-2">
                  <Link
                    href="/daily"
                    className="flex items-center gap-2 text-sm text-foreground/80 hover:text-primary transition-colors"
                  >
                    <span className="w-3.5 h-3.5 text-primary text-xs font-bold flex items-center justify-center">W</span>
                    AI 日报
                  </Link>
                  <Link
                    href="/leaderboard"
                    className="flex items-center gap-2 text-sm text-foreground/80 hover:text-primary transition-colors"
                  >
                    <span className="w-3.5 h-3.5 text-primary text-xs font-bold flex items-center justify-center">L</span>
                    排行榜
                  </Link>
                  <a
                    href="/api/rss"
                    className="flex items-center gap-2 text-sm text-foreground/80 hover:text-primary transition-colors"
                  >
                    <span className="w-3.5 h-3.5 text-primary text-xs font-bold flex items-center justify-center">R</span>
                    RSS 订阅
                  </a>
                </div>
              </div>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
