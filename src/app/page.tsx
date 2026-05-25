'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/navbar';
import {
  Clock, Flame, ArrowRight, Hash, ChevronRight,
  Brain, GitBranch, Rocket, Landmark, GraduationCap, Bot, Building, Eye,
  Megaphone, Cpu, Wrench, Briefcase, FlaskConical, TrendingUp, Scale, Telescope,
} from 'lucide-react';

// 橘鸦分类的图标映射
const categoryIcons: Record<string, React.ElementType> = {
  '要闻': Megaphone,
  '模型发布': Cpu,
  '开发生态': Wrench,
  '产品应用': Rocket,
  '技术与洞察': FlaskConical,
  '行业动态': TrendingUp,
  '政策与治理': Scale,
  '前瞻与传闻': Telescope,
};

// 橘鸦分类的显示顺序
const categoryOrder = [
  '要闻', '模型发布', '开发生态', '产品应用',
  '技术与洞察', '行业动态', '政策与治理', '前瞻与传闻',
];

// 橘鸦分类的颜色
const categoryColors: Record<string, string> = {
  '要闻': 'text-red-500 bg-red-500/8',
  '模型发布': 'text-blue-500 bg-blue-500/8',
  '开发生态': 'text-emerald-500 bg-emerald-500/8',
  '产品应用': 'text-green-500 bg-green-500/8',
  '技术与洞察': 'text-cyan-500 bg-cyan-500/8',
  '行业动态': 'text-orange-500 bg-orange-500/8',
  '政策与治理': 'text-amber-500 bg-amber-500/8',
  '前瞻与传闻': 'text-purple-500 bg-purple-500/8',
};

const categoryBorderColors: Record<string, string> = {
  '要闻': 'border-red-500/20',
  '模型发布': 'border-blue-500/20',
  '开发生态': 'border-emerald-500/20',
  '产品应用': 'border-green-500/20',
  '技术与洞察': 'border-cyan-500/20',
  '行业动态': 'border-orange-500/20',
  '政策与治理': 'border-amber-500/20',
  '前瞻与传闻': 'border-purple-500/20',
};

interface NewsItem {
  title: string;
  url: string;
  quote: string;
  snippet: string;
}

interface CategoryData {
  category: string;
  items: NewsItem[];
}

interface JuyaNewsResponse {
  success: boolean;
  data: {
    totalCount: number;
    categories: CategoryData[];
    fetchedAt: string;
  };
}

export default function HomePage() {
  const [data, setData] = useState<JuyaNewsResponse['data'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadNews() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/juya/news');
        const json: JuyaNewsResponse = await res.json();
        if (json.success) {
          setData(json.data);
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

  // Loading skeleton
  if (loading) {
    return (
      <div className="min-h-screen bg-background font-sans">
        <Navbar />
        <main className="max-w-7xl mx-auto px-6 py-8">
          <div className="animate-pulse space-y-8">
            <div className="h-8 bg-muted rounded w-48" />
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-4">
                <div className="h-6 bg-muted rounded w-32" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3].map((j) => (
                    <div key={j} className="h-32 bg-muted rounded-lg" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  const categories = data?.categories || [];
  const totalCount = data?.totalCount || 0;
  const activeCategories = categories.filter(cat => cat.items.length > 0);

  // Get all quotes for keywords extraction
  const allQuotes = categories.flatMap(cat => cat.items.map(item => item.snippet));
  const hotKeywords = Array.from(
    new Set(
      allQuotes
        .flatMap(text => text.match(/[A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*/g) || [])
        .filter(kw => kw.length > 3 && !/^(The|This|That|And|But|For|With)$/i.test(kw))
    )
  ).slice(0, 8);

  return (
    <div className="min-h-screen bg-background font-sans">
      <Navbar />
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold font-display tracking-tight flex items-center gap-2">
              <Flame className="w-7 h-7 text-primary" />
              橘鸦AI早报
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              共 {totalCount} 条资讯 · {activeCategories.length} 个分类
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
        ) : activeCategories.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-sm">暂无资讯</p>
          </div>
        ) : (
          <div className="flex gap-6">
            {/* Main content */}
            <div className="flex-1 min-w-0 space-y-10">
              {/* ===== Category Sections ===== */}
              {activeCategories.map((catData) => {
                const cat = catData.category;
                const items = catData.items;
                const IconComponent = categoryIcons[cat];
                const colorCls = categoryColors[cat] || 'text-primary bg-primary/8';
                const borderColor = categoryBorderColors[cat] || 'border-primary/20';

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
                          {cat}
                        </h2>
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                          {items.length}
                        </span>
                      </div>
                    </div>

                    {/* Category cards grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {items.map((item, idx) => (
                        <a
                          key={`${item.url}-${idx}`}
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`group block bg-card rounded-lg border ${borderColor} hover:border-primary/40 hover:shadow-md transition-all overflow-hidden`}
                        >
                          <div className={`h-1 ${colorCls.replace('text-', 'bg-').replace('/8', '/30')}`} />
                          <div className="p-4">
                            <h3 className="text-sm font-semibold font-display text-foreground group-hover:text-primary transition-colors leading-snug mb-2 line-clamp-2">
                              {item.title}
                            </h3>
                            {item.quote && (
                              <p className="text-xs text-muted-foreground leading-relaxed mb-2 line-clamp-2 italic border-l-2 border-primary/20 pl-2">
                                "{item.quote.slice(0, 80)}..."
                              </p>
                            )}
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                              <span>橘鸦AI早报</span>
                              <span className="flex items-center gap-0.5">
                                <ArrowRight className="w-2.5 h-2.5" />
                                原文
                              </span>
                            </div>
                          </div>
                        </a>
                      ))}
                    </div>
                  </section>
                );
              })}
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
                  {activeCategories.map((catData) => {
                    const cat = catData.category;
                    const IconComponent = categoryIcons[cat];
                    const count = catData.items.length;
                    return (
                      <a
                        key={cat}
                        href={`#${encodeURIComponent(cat)}`}
                        className="flex items-center gap-2 text-sm text-foreground/80 hover:text-primary transition-colors py-0.5"
                      >
                        {IconComponent && <IconComponent className="w-3.5 h-3.5" />}
                        <span className="flex-1">{cat}</span>
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
