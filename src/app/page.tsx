'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/navbar';
import { Clock, ArrowRight, Sparkles, Calendar, Rss } from 'lucide-react';

// ============ Types ============

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
  data?: {
    days: DayData[];
    fetchedAt: string;
  };
  fallback?: boolean;
  error?: string;
}

interface JuyaNewsItem {
  title: string;
  url: string;
  quote: string;
  snippet: string;
}

interface JuyaCategory {
  category: string;
  items: JuyaNewsItem[];
}

interface JuyaResponse {
  success: boolean;
  data?: {
    categories: JuyaCategory[];
    fetchedAt: string;
  };
  error?: string;
}

// 橘鸦8分类
const JUYU_CATEGORIES = [
  "要闻",
  "模型发布",
  "开发生态",
  "产品应用",
  "技术与洞察",
  "行业动态",
  "政策与治理",
  "前瞻与传闻",
];

// ============ Helpers ============

function formatTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch {
    return '';
  }
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

function generateId(): string {
  return `juya-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ============ Component ============

export default function HomePage() {
  const [daysData, setDaysData] = useState<DayData[]>([]);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFallback, setIsFallback] = useState(false);

  // 加载数据
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);

      try {
        // 先尝试从 Supabase 获取
        const res = await fetch('/api/news/recent?days=7');
        const json: RecentNewsResponse = await res.json();

        if (json.success && json.data?.days && json.data.days.length > 0) {
          setDaysData(json.data.days);
          setIsFallback(false);
          return;
        }

        // Supabase 失败，尝试 RSS fallback
        console.log('[Home] Supabase no data, trying RSS fallback...');
        const juyaRes = await fetch('/api/juya/news');
        const juyaJson: JuyaResponse = await juyaRes.json();

        if (juyaJson.success && juyaJson.data?.categories) {
          // 将 juya 数据转换为 DayData 格式
          const today = new Date().toISOString().slice(0, 10);
          const dayData: DayData = {
            date: today,
            dateLabel: `今天 · ${new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}`,
            categories: juyaJson.data.categories.map(cat => ({
              category: cat.category,
              count: cat.items.length,
              items: cat.items.map(item => ({
                id: generateId(),
                title: item.title,
                source: '橘鸦AI早报',
                sourceUrl: item.url,
                summary: item.snippet,
                publishedAt: new Date().toISOString(),
              })),
            })),
            totalCount: juyaJson.data.categories.reduce((sum, cat) => sum + cat.items.length, 0),
          };
          setDaysData([dayData]);
          setIsFallback(true);
          return;
        }

        // 完全失败
        setError('暂无资讯数据');
      } catch (e) {
        console.error('[Home] Load error:', e);
        setError('加载数据失败');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // 计算总数
  const totalCount = useMemo(() => {
    return daysData.reduce((sum, day) => sum + day.totalCount, 0);
  }, [daysData]);

  // 当前选中日期的数据
  const currentDay = daysData[selectedDayIndex] || null;

  // 动态计算分类 flex-grow
  const categoryFlex = useMemo(() => {
    if (!currentDay || currentDay.totalCount === 0) return [];

    return currentDay.categories.map(cat => ({
      ...cat,
      flexGrow: Math.max(1, Math.round((cat.count / currentDay.totalCount) * 10)),
    }));
  }, [currentDay]);

  // 当前选中的分类下的新闻
  const displayedNews = useMemo(() => {
    if (!currentDay) return [];

    if (selectedCategory) {
      const cat = currentDay.categories.find(c => c.category === selectedCategory);
      return cat?.items || [];
    }

    // 显示所有分类的新闻
    return currentDay.categories.flatMap(c => c.items);
  }, [currentDay, selectedCategory]);

  // 加载态
  if (loading) {
    return (
      <div className="min-h-screen bg-background font-sans">
        <Navbar />
        <main className="max-w-7xl mx-auto px-6 py-8">
          {/* 日期标签骨架 */}
          <div className="flex gap-3 mb-8 animate-pulse">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-10 bg-muted rounded-lg w-28" />
            ))}
          </div>
          {/* 分类标签骨架 */}
          <div className="flex gap-2 mb-6 animate-pulse">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-8 bg-muted rounded-full w-20" />
            ))}
          </div>
          {/* 新闻卡片骨架 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-48 bg-muted rounded-lg" />
            ))}
          </div>
        </main>
      </div>
    );
  }

  // 错误/空状态
  if (error || daysData.length === 0) {
    return (
      <div className="min-h-screen bg-background font-sans">
        <Navbar />
        <main className="max-w-7xl mx-auto px-6 py-16 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
            <Rss className="w-8 h-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold mb-2">{error || '暂无资讯数据'}</h2>
          <p className="text-muted-foreground text-sm mb-6">
            请稍后再试，或联系管理员检查数据同步状态
          </p>
          <Link
            href="/news"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors"
          >
            查看全部资讯
            <ArrowRight className="w-4 h-4" />
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background font-sans">
      <Navbar />

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* 标题区 */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold font-display tracking-tight flex items-center gap-2">
              <Sparkles className="w-7 h-7 text-primary" />
              AI 资讯精选
            </h1>
            <p className="text-sm text-muted-foreground mt-2 flex items-center gap-2">
              {isFallback && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 text-xs">
                  <Rss className="w-3 h-3" />
                  RSS实时
                </span>
              )}
              共 {totalCount} 条资讯 · 最近 7 天
            </p>
          </div>
          <Link
            href="/daily"
            className="text-sm text-primary hover:underline flex items-center gap-1 shrink-0"
          >
            查看完整日报
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* 日期选择标签 */}
        <div className="flex gap-3 mb-8 overflow-x-auto pb-2 scrollbar-hide">
          {daysData.map((day, idx) => {
            const isActive = idx === selectedDayIndex;
            return (
              <button
                key={day.date}
                onClick={() => {
                  setSelectedDayIndex(idx);
                  setSelectedCategory(null);
                }}
                className={`flex-shrink-0 px-4 py-2.5 rounded-lg font-medium text-sm transition-all ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-card border border-border hover:border-primary/30 hover:bg-primary/5'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Calendar className={`w-4 h-4 ${isActive ? '' : 'text-muted-foreground'}`} />
                  <span>{formatDate(day.date)}</span>
                </div>
                <div className={`text-xs mt-0.5 ${isActive ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                  {day.totalCount} 条
                </div>
              </button>
            );
          })}
        </div>

        {/* 分类标签栏 */}
        {currentDay && currentDay.categories.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                selectedCategory === null
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card border border-border hover:border-primary/30 text-muted-foreground hover:text-foreground'
              }`}
            >
              全部 ({currentDay.totalCount})
            </button>
            {categoryFlex.map(cat => (
              <button
                key={cat.category}
                onClick={() => setSelectedCategory(cat.category)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                  selectedCategory === cat.category
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card border border-border hover:border-primary/30 text-muted-foreground hover:text-foreground'
                }`}
                style={{
                  flexGrow: cat.flexGrow,
                  maxWidth: '200px',
                }}
              >
                {cat.category} ({cat.count})
              </button>
            ))}
          </div>
        )}

        {/* 资讯网格 */}
        {displayedNews.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayedNews.map((item, idx) => (
              <a
                key={item.id}
                href={item.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group block bg-card rounded-lg border border-border/40 hover:border-primary/40 hover:shadow-md transition-all overflow-hidden"
              >
                {/* 顶部色条 */}
                <div className="h-1.5 bg-gradient-to-r from-primary/50 to-primary/20" />

                <div className="p-5">
                  {/* 序号 + 分类 */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-bold text-primary/30 font-display text-2xl leading-none">
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <span className="text-[10px] font-medium text-primary/80 bg-primary/8 px-2 py-0.5 rounded">
                      {item.source}
                    </span>
                  </div>

                  {/* 标题 */}
                  <h3 className="font-bold font-display text-foreground group-hover:text-primary transition-colors leading-snug mb-3 line-clamp-2 min-h-[2.8em]">
                    {item.title}
                  </h3>

                  {/* 摘要 */}
                  {item.summary && (
                    <p className="text-muted-foreground text-sm leading-relaxed mb-4 line-clamp-3">
                      {item.summary}
                    </p>
                  )}

                  {/* 元信息 */}
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span>{item.source}</span>
                    {item.publishedAt && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTime(item.publishedAt)}
                      </span>
                    )}
                  </div>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-sm">该分类暂无资讯</p>
          </div>
        )}

        {/* 底部查看更多 */}
        <div className="mt-10 text-center">
          <Link
            href="/news"
            className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-primary bg-primary/8 hover:bg-primary/15 rounded-lg transition-colors"
          >
            查看全部资讯
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </main>
    </div>
  );
}
