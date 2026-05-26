'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Calendar,
  ChevronRight,
  ArrowLeft,
  BookOpen,
  Loader2,
} from 'lucide-react';

interface DailyReport {
  id: string;
  reportDate: string;
  overview: string;
  hotTopics: string[];
  newsCount: number;
  createdAt: string;
}

interface DailyListItem {
  id: string;
  reportDate: string;
  overview: string;
  newsCount: number;
}

interface DailyContentProps {
  initialReport: DailyReport | null;
  initialArchive: DailyListItem[];
  initialDate: string | null;
  highlight: string | null;
}

type ViewMode = 'latest' | 'archive';

function renderContent(content: string): string {
  if (content.includes('<h2>') || content.includes('<h3>') || content.includes('<blockquote>')) {
    return content
      .replace(/<h1>(.*?)<\/h1>/g, '<h1 class="text-3xl font-bold font-display text-foreground mb-6 tracking-tight">$1</h1>')
      .replace(/<h2><a href="(.*?)">(.*?)<\/a>\s*<code>#(\d+)<\/code><\/h2>/g, '<h2 id="news-$3" class="text-xl font-bold font-display text-foreground mt-10 mb-4 tracking-tight border-b border-border/30 pb-3 scroll-mt-20"><a href="$1" class="text-primary hover:underline" target="_blank" rel="noopener noreferrer">$2</a> <a href="#news-$3" class="text-muted-foreground hover:text-primary no-underline"><code class="px-1.5 py-0.5 bg-muted rounded text-sm font-mono text-primary">#$3</code></a></h2>')
      .replace(/<h2>(.*?)<code>#(\d+)<\/code><\/h2>/g, '<h2 id="news-$2" class="text-xl font-bold font-display text-foreground mt-10 mb-4 tracking-tight border-b border-border/30 pb-3 scroll-mt-20">$1 <a href="#news-$2" class="text-muted-foreground hover:text-primary no-underline"><code class="px-1.5 py-0.5 bg-muted rounded text-sm font-mono text-primary">#$2</code></a></h2>')
      .replace(/<h3>(.*?)<\/h3>/g, '<h3 class="text-lg font-bold font-display text-foreground mt-8 mb-3 tracking-tight text-primary">$1</h3>')
      .replace(/<blockquote>([\s\S]*?)<\/blockquote>/g, '<blockquote class="border-l-4 border-primary/30 pl-4 py-2 my-4 bg-primary/5 rounded-r-lg italic text-foreground/80">$1</blockquote>')
      .replace(/<p>(.*?)<\/p>/g, '<p class="text-[15px] text-foreground/85 leading-[1.85] mb-3">$1</p>')
      .replace(/<li>(.*?)<\/li>/g, '<li class="text-[15px] text-foreground/85 leading-[1.85] mb-1 ml-4">$1</li>')
      .replace(/<ul>([\s\S]*?)<\/ul>/g, '<ul class="list-disc mb-4">$1</ul>')
      .replace(/<ol>([\s\S]*?)<\/ol>/g, '<ol class="list-decimal mb-4">$1</ol>')
      .replace(/<hr\s*\/?>/g, '<hr class="border-border/30 my-8" />')
      .replace(/<a href="(.*?)">(.*?)<\/a>/g, '<a href="$1" class="text-primary hover:underline" target="_blank" rel="noopener noreferrer">$2</a>')
      .replace(/<strong>(.*?)<\/strong>/g, '<strong class="font-semibold text-foreground">$1</strong>')
      .replace(/<code>(.*?)<\/code>/g, '<code class="px-1.5 py-0.5 bg-muted rounded text-sm font-mono text-primary">$1</code>')
      .replace(/<img src="(.*?)" alt="(.*?)"\s*\/?>/g, '<img src="$1" alt="$2" class="max-w-full h-auto rounded-lg my-4 shadow-sm" />')
      .replace(/<img src="(.*?)"\s*\/?>/g, '<img src="$1" class="max-w-full h-auto rounded-lg my-4 shadow-sm" />');
  }
  return content.split('\n').map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return '<br/>';
    if (trimmed.startsWith('### ')) return `<h3 class="text-lg font-bold font-display text-foreground mt-8 mb-3 tracking-tight">${trimmed.slice(4)}</h3>`;
    if (trimmed.startsWith('## ')) return `<h2 class="text-xl font-bold font-display text-foreground mt-10 mb-4 tracking-tight border-b border-border/30 pb-3">${trimmed.slice(3)}</h2>`;
    const withBold = trimmed.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>');
    return `<p class="text-[15px] text-foreground/85 leading-[1.85] mb-3">${withBold}</p>`;
  }).join('');
}

export function DailyContent({ initialReport, initialArchive, initialDate, highlight }: DailyContentProps) {
  const [mode, setMode] = useState<ViewMode>('latest');
  const [report, setReport] = useState<DailyReport | null>(initialReport);
  const [archiveList, setArchiveList] = useState<DailyListItem[]>(initialArchive);
  const [selectedDate, setSelectedDate] = useState<string | null>(initialDate);
  // SSR 没拿到数据时，客户端立即 fetch
  const needClientFetch = !initialReport;
  const [loading, setLoading] = useState(needClientFetch);

  useEffect(() => {
    if (initialReport) return;
    // SSR 失败，客户端 fetch
    const url = initialDate ? `/api/daily?date=${initialDate}` : '/api/daily';
    fetch(url).then(r => r.json()).then(json => {
      if (json.success && json.data) {
        setReport({ ...json.data, hotTopics: Array.isArray(json.data.hotTopics) ? json.data.hotTopics : [] });
      }
    }).catch(console.error).finally(() => setLoading(false));
  }, [initialReport, initialDate]);

  const loadByDate = useCallback(async (date: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/daily?date=${date}`);
      const json = await res.json();
      if (json.success && json.data) {
        setReport({ ...json.data, hotTopics: Array.isArray(json.data.hotTopics) ? json.data.hotTopics : [] });
        setSelectedDate(date);
        setMode('latest');
      }
    } catch (err) {
      console.error('Failed to load daily report:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadArchive = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/daily?list=true');
      const json = await res.json();
      if (json.success) setArchiveList(Array.isArray(json.data) ? json.data : []);
    } catch (err) {
      console.error('Failed to load archive list:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // highlight 滚动
  useEffect(() => {
    if (!report || !highlight) return;
    requestAnimationFrame(() => {
      const h2s = document.querySelectorAll('article h2');
      for (const h2 of h2s) {
        if (h2.textContent?.includes(highlight)) {
          h2.scrollIntoView({ behavior: 'smooth', block: 'center' });
          h2.classList.add('ring-2', 'ring-primary/40', 'rounded', 'transition-all');
          setTimeout(() => h2.classList.remove('ring-2', 'ring-primary/40', 'rounded'), 3000);
          break;
        }
      }
    });
  }, [report, highlight]);

  const handleTabChange = (m: ViewMode) => {
    setMode(m);
    if (m === 'archive') loadArchive();
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 星期${weekdays[d.getDay()]}`;
  };

  if (loading) {
    return (
      <main className="max-w-5xl mx-auto px-8 py-8">
        <div className="flex flex-col items-center justify-center py-32 gap-4">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-muted-foreground text-sm">正在加载日报...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-5xl mx-auto px-8 py-8">
      <div className="flex items-center justify-between mb-8 border-b border-border/30 pb-6">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
            <ArrowLeft className="w-4 h-4 inline mr-1 -mt-0.5" />首页
          </Link>
          <span className="text-border">|</span>
          <span className="text-xs text-muted-foreground font-semibold uppercase tracking-widest">AI 日报</span>
        </div>
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          <button onClick={() => handleTabChange('latest')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${mode === 'latest' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            <BookOpen className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />当期日报
          </button>
          <button onClick={() => handleTabChange('archive')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${mode === 'archive' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            <Calendar className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />往期
          </button>
        </div>
      </div>

      {mode === 'archive' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {archiveList.length === 0 ? (
            <div className="col-span-full text-center py-16 text-muted-foreground text-sm">暂无往期日报</div>
          ) : (
            archiveList.map((item) => (
              <button key={item.id} onClick={() => loadByDate(item.reportDate)} className="w-full text-left block p-5 bg-card rounded-lg border border-border/30 hover:border-primary/30 hover:shadow-sm transition-all">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{formatDate(item.reportDate)}</h3>
                    {item.overview && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.overview.slice(0, 100)}...</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-4">
                    <span className="text-xs text-muted-foreground">{item.newsCount} 条</span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {mode === 'latest' && (
        <>
          {report ? (
            <article>
              <header className="mb-8">
                <h1 className="text-3xl font-bold font-display tracking-tight">{formatDate(report.reportDate)}</h1>
                <div className="flex items-center gap-3 mt-3">
                  <span className="text-xs text-muted-foreground">共 {report.newsCount} 条资讯</span>
                  {report.hotTopics && report.hotTopics.length > 0 && (
                    <>
                      <span className="text-border">·</span>
                      <div className="flex flex-wrap gap-1.5">
                        {report.hotTopics.slice(0, 5).map((topic) => (
                          <span key={topic} className="px-2 py-0.5 text-[11px] font-medium bg-primary/8 text-primary rounded">#{topic}</span>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </header>
              {report.overview && (
                <div className="prose-custom" dangerouslySetInnerHTML={{ __html: renderContent(report.overview) }} />
              )}
            </article>
          ) : (
            <div className="text-center py-16">
              <p className="text-muted-foreground text-sm mb-4">暂无日报数据</p>
              <p className="text-xs text-muted-foreground">可在管理后台手动生成日报</p>
            </div>
          )}
        </>
      )}
    </main>
  );
}
