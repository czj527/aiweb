'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import Link from 'next/link';
import { type NewsCategory, categoryConfig } from '@/lib/types';
import { getLatestDaily, getLatestWeekly } from '@/lib/api-client';

interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  sourceUrl: string;
  category: string;
  importanceScore: number;
  importanceLevel: string;
  keywords: string[];
  publishedAt: string;
}

type ReportType = 'daily' | 'weekly';

export default function NewsPage() {
  return (
    <Suspense fallback={null}>
      <NewsPageInner />
    </Suspense>
  );
}

function NewsPageInner() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<ReportType>('daily');
  const [news, setNews] = useState<NewsItem[]>([]);
  const [reportDate, setReportDate] = useState('');
  const [overview, setOverview] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>(
    searchParams.get('category') || 'all'
  );
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = activeTab === 'daily'
        ? await getLatestDaily(false)
        : await getLatestWeekly();

      if (result) {
        setNews(result.news || []);
        if (activeTab === 'daily' && 'reportDate' in result) {
          setReportDate((result as { reportDate: string }).reportDate);
        } else if ('weekStart' in result && 'weekEnd' in result) {
          const r = result as { weekStart: string; weekEnd: string };
          setReportDate(`${r.weekStart} ~ ${r.weekEnd}`);
        }
        setOverview(result.overview || '');
      } else {
        setNews([]);
        setError(activeTab === 'daily' ? '暂无日报数据' : '暂无周报数据');
      }
    } catch {
      setError('数据加载失败');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredNews = news.filter(n => {
    if (filterCategory !== 'all' && n.category !== filterCategory) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return n.title.toLowerCase().includes(q) || n.summary?.toLowerCase().includes(q);
    }
    return true;
  });

  const topNews = filteredNews.filter(n => ['SSS', 'SS'].includes(n.importanceLevel));
  const otherNews = filteredNews.filter(n => !['SSS', 'SS'].includes(n.importanceLevel));

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
              ← 返回首页
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-foreground">全部AI资讯</h1>
          {reportDate && (
            <p className="text-muted-foreground text-sm mt-1">{reportDate}</p>
          )}
        </div>

        {/* Tab switch */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('daily')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'daily'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            日报
          </button>
          <button
            onClick={() => setActiveTab('weekly')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'weekly'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            周报
          </button>
        </div>

        {/* Overview */}
        {overview && (
          <div className="bg-card rounded-lg border border-border p-5 mb-6">
            <p className="text-foreground text-sm leading-relaxed">{overview}</p>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-3 mb-6 flex-wrap">
          <input
            type="text"
            placeholder="搜索新闻..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="px-3 py-1.5 text-sm border border-border rounded-md bg-muted text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            className="px-3 py-1.5 text-sm border border-border rounded-md bg-muted text-foreground"
          >
            <option value="all">全部分类</option>
            {Object.entries(categoryConfig).map(([key, config]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </select>
          <span className="text-muted-foreground text-sm self-center ml-auto">
            共 {filteredNews.length} 条资讯
          </span>
        </div>

        {/* Loading / Error */}
        {loading ? (
          <div className="text-center py-16 text-muted-foreground">加载中...</div>
        ) : error ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground">{error}</p>
            <Link href="/" className="text-primary text-sm mt-2 inline-block hover:underline">
              返回首页
            </Link>
          </div>
        ) : (
          <>
            {/* Top news section */}
            {topNews.length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <span className="w-1 h-5 bg-primary rounded-full" />
                  重要资讯
                  <span className="text-muted-foreground text-sm font-normal">({topNews.length})</span>
                </h2>
                <div className="space-y-3">
                  {topNews.map((item) => (
                    <NewsCard key={item.id} item={item} />
                  ))}
                </div>
              </div>
            )}

            {/* Other news section */}
            {otherNews.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <span className="w-1 h-5 bg-muted-foreground/30 rounded-full" />
                  更多资讯
                  <span className="text-muted-foreground text-sm font-normal">({otherNews.length})</span>
                </h2>
                <div className="space-y-2">
                  {otherNews.map((item) => (
                    <NewsCardCompact key={item.id} item={item} />
                  ))}
                </div>
              </div>
            )}

            {filteredNews.length === 0 && (
              <div className="text-center py-16 text-muted-foreground">无匹配的新闻</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function NewsCard({ item }: { item: NewsItem }) {
  const config = categoryConfig[item.category as NewsCategory];
  return (
    <Link href={`/detail?id=${item.id}`} className="block">
      <div className="bg-card rounded-lg border border-border p-4 hover:bg-muted/50 transition-colors">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-foreground font-medium leading-snug line-clamp-2">
              {item.title}
            </h3>
            {item.summary && (
              <p className="text-muted-foreground text-sm mt-1.5 line-clamp-2">{item.summary}</p>
            )}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {config && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                  {config.label}
                </span>
              )}
              <span className={`text-xs px-1.5 py-0.5 rounded ${
                item.importanceLevel === 'SSS' ? 'bg-red-100 text-red-800' :
                item.importanceLevel === 'SS' ? 'bg-orange-100 text-orange-800' :
                'bg-muted text-muted-foreground'
              }`}>
                {item.importanceLevel}
              </span>
              <span className="text-xs text-muted-foreground">{item.source}</span>
              {item.keywords?.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {item.keywords.slice(0, 3).join('、')}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function NewsCardCompact({ item }: { item: NewsItem }) {
  const config = categoryConfig[item.category as NewsCategory];
  return (
    <Link href={`/detail?id=${item.id}`} className="block">
      <div className="flex items-center gap-3 px-3 py-2.5 rounded-md border border-border hover:bg-muted/50 transition-colors">
        <div className="flex-1 min-w-0">
          <span className="text-foreground text-sm line-clamp-1">{item.title}</span>
        </div>
        {config && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
            {config.label}
          </span>
        )}
        <span className="text-xs text-muted-foreground shrink-0">{item.source}</span>
      </div>
    </Link>
  );
}
