'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/navbar';
import { categoryConfig as apiCategoryConfig, type NewsItemResponse } from '@/lib/api-client';
import { type NewsCategory, categoryConfig as typeCategoryConfig } from '@/lib/types';
import {
  Clock, Flame, ArrowRight, Hash, ChevronRight,
  Brain, GitBranch, Rocket, Landmark, GraduationCap, Bot, Building, Eye,
} from 'lucide-react';

// Icon mapping for categories
const categoryIcons: Record<string, React.ElementType> = {
  model: Brain,
  opensource: GitBranch,
  product: Rocket,
  policy: Landmark,
  research: GraduationCap,
  agent: Bot,
  industry: Building,
  rumor: Eye,
};

// Category display order and colors
const categoryOrder: NewsCategory[] = [
  'model', 'agent', 'opensource', 'product', 'research', 'industry', 'policy', 'rumor',
];

const categoryColors: Record<string, string> = {
  model: 'text-blue-500 bg-blue-500/8',
  agent: 'text-purple-500 bg-purple-500/8',
  opensource: 'text-emerald-500 bg-emerald-500/8',
  product: 'text-green-500 bg-green-500/8',
  policy: 'text-amber-500 bg-amber-500/8',
  research: 'text-cyan-500 bg-cyan-500/8',
  industry: 'text-orange-500 bg-orange-500/8',
  rumor: 'text-pink-500 bg-pink-500/8',
};

const categoryBorderColors: Record<string, string> = {
  model: 'border-blue-500/20',
  agent: 'border-purple-500/20',
  opensource: 'border-emerald-500/20',
  product: 'border-green-500/20',
  policy: 'border-amber-500/20',
  research: 'border-cyan-500/20',
  industry: 'border-orange-500/20',
  rumor: 'border-pink-500/20',
};

interface GroupedData {
  hours: number;
  totalCount: number;
  byCategory: Record<string, NewsItemResponse[]>;
  topNews: NewsItemResponse[];
}

export default function HomePage() {
  const [data, setData] = useState<GroupedData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadHot() {
      setLoading(true);
      try {
        const res = await fetch('/api/hot?hours=24&grouped=true');
        const json = await res.json();
        if (json.success) {
          setData(json.data);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    loadHot();
  }, []);

  const topNews = data?.topNews || [];
  const byCategory = data?.byCategory || {};
  const totalCount = data?.totalCount || 0;

  // Get all news for keywords extraction
  const allNews = Object.values(byCategory).flat();
  const hotKeywords = Array.from(
    new Set(allNews.flatMap((n) => n.keywords || []))
  ).slice(0, 8);

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

  // Get category label from either config source
  const getCategoryLabel = (cat: string) => {
    return typeCategoryConfig[cat as NewsCategory]?.label
      || apiCategoryConfig[cat]?.label
      || cat;
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="min-h-screen bg-background font-sans">
        <Navbar />
        <main className="max-w-7xl mx-auto px-6 py-8">
          <div className="animate-pulse space-y-8">
            {/* Hero skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-56 bg-muted rounded-lg" />
              ))}
            </div>
            {/* Category sections skeleton */}
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-3">
                <div className="h-6 bg-muted rounded w-32" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {[1, 2, 3, 4].map((j) => (
                    <div key={j} className="h-36 bg-muted rounded-lg" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  // Filter categories that have news, in display order
  const activeCategories = categoryOrder.filter((cat) => byCategory[cat]?.length > 0);

  return (
    <div className="min-h-screen bg-background font-sans">
      <Navbar />
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold font-display tracking-tight flex items-center gap-2">
              <Flame className="w-7 h-7 text-primary" />
              AI 资讯快览
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              过去 24 小时 · 共 {totalCount} 条资讯 · {activeCategories.length} 个分类
            </p>
          </div>
          <Link
            href="/news"
            className="text-sm text-primary hover:underline flex items-center gap-1 shrink-0"
          >
            全部资讯
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {topNews.length === 0 && activeCategories.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-sm mb-4">暂无热点资讯</p>
            <Link href="/news" className="text-primary text-sm hover:underline">
              查看全部资讯 →
            </Link>
          </div>
        ) : (
          <div className="flex gap-6">
            {/* Main content */}
            <div className="flex-1 min-w-0 space-y-10">

              {/* ===== Hero: Top 3 News ===== */}
              {topNews.length > 0 && (
                <section>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {topNews.map((item, idx) => {
                      const badge = importanceLabel(item.importanceScore);
                      const isFirst = idx === 0;
                      return (
                        <Link
                          key={item.id}
                          href={`/detail?id=${item.id}`}
                          className={`group block bg-card rounded-lg border border-border/40 hover:border-primary/40 hover:shadow-lg transition-all overflow-hidden ${
                            isFirst ? 'md:col-span-2 md:row-span-2' : ''
                          }`}
                        >
                          <div className={`h-1.5 bg-gradient-to-r from-primary/70 to-primary/20`} />
                          <div className={isFirst ? 'p-6' : 'p-4'}>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-1.5">
                                {badge && (
                                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${badge.cls}`}>
                                    {badge.text}
                                  </span>
                                )}
                                <span className="text-[10px] font-medium text-primary/80 bg-primary/8 px-2 py-0.5 rounded">
                                  {getCategoryLabel(item.category)}
                                </span>
                              </div>
                              <span className="font-bold text-primary/15 font-display leading-none text-2xl">
                                {String(idx + 1).padStart(2, '0')}
                              </span>
                            </div>
                            <h2 className={`font-bold font-display text-foreground group-hover:text-primary transition-colors leading-snug mb-3 ${
                              isFirst ? 'text-xl line-clamp-3 min-h-[4.5em]' : 'text-sm line-clamp-2 min-h-[2.4em]'
                            }`}>
                              {item.title}
                            </h2>
                            {isFirst && (
                              <p className="text-sm text-muted-foreground leading-relaxed mb-4 line-clamp-4">
                                {item.summary}
                              </p>
                            )}
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
                </section>
              )}

              {/* ===== Category Sections ===== */}
              {activeCategories.map((cat) => {
                const items = byCategory[cat] || [];
                const IconComponent = categoryIcons[cat];
                const colorCls = categoryColors[cat] || 'text-primary bg-primary/8';
                const borderColor = categoryBorderColors[cat] || 'border-primary/20';
                const label = getCategoryLabel(cat);

                return (
                  <section key={cat}>
                    {/* Category header */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2.5">
                        {IconComponent && (
                          <div className={`w-7 h-7 rounded-md flex items-center justify-center ${colorCls}`}>
                            <IconComponent className="w-4 h-4" />
                          </div>
                        )}
                        <h2 className="text-lg font-bold font-display text-foreground">
                          {label}
                        </h2>
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                          {items.length}
                        </span>
                      </div>
                      <Link
                        href={`/news?category=${cat}`}
                        className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-0.5"
                      >
                        更多
                        <ChevronRight className="w-3 h-3" />
                      </Link>
                    </div>

                    {/* Category cards grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                      {items.map((item) => {
                        const badge = importanceLabel(item.importanceScore);
                        return (
                          <Link
                            key={item.id}
                            href={`/detail?id=${item.id}`}
                            className={`group block bg-card rounded-lg border ${borderColor} hover:border-primary/40 hover:shadow-md transition-all overflow-hidden`}
                          >
                            <div className={`h-1 ${colorCls.replace('text-', 'bg-').replace('/8', '/30')}`} />
                            <div className="p-3.5">
                              <div className="flex items-center gap-1.5 mb-2">
                                {badge && (
                                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${badge.cls}`}>
                                    {badge.text}
                                  </span>
                                )}
                              </div>
                              <h3 className="text-sm font-semibold font-display text-foreground group-hover:text-primary transition-colors leading-snug mb-2 line-clamp-2 min-h-[2.4em]">
                                {item.title}
                              </h3>
                              <p className="text-xs text-muted-foreground leading-relaxed mb-2.5 line-clamp-2">
                                {item.summary}
                              </p>
                              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                <span className="truncate">{item.source}</span>
                                <span className="flex items-center gap-0.5 shrink-0">
                                  <Clock className="w-2.5 h-2.5" />
                                  {formatTime(item.publishedAt)}
                                </span>
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </section>
                );
              })}

              {/* View all link */}
              <div className="text-center pt-4 pb-8">
                <Link
                  href="/news"
                  className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-primary bg-primary/8 hover:bg-primary/15 rounded-lg transition-colors"
                >
                  查看全部资讯
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Right sidebar */}
            <aside className="w-52 shrink-0 hidden lg:block space-y-6">
              {/* Hot keywords */}
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

              {/* Category quick nav */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  分类导航
                </h3>
                <div className="space-y-1.5">
                  {activeCategories.map((cat) => {
                    const IconComponent = categoryIcons[cat];
                    const label = getCategoryLabel(cat);
                    const count = byCategory[cat]?.length || 0;
                    return (
                      <a
                        key={cat}
                        href={`#${cat}`}
                        className="flex items-center gap-2 text-sm text-foreground/80 hover:text-primary transition-colors py-0.5"
                      >
                        {IconComponent && <IconComponent className="w-3.5 h-3.5" />}
                        <span className="flex-1">{label}</span>
                        <span className="text-[10px] text-muted-foreground">{count}</span>
                      </a>
                    );
                  })}
                </div>
              </div>

              {/* Quick links */}
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
