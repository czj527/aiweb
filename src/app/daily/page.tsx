'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Navbar } from '@/components/navbar';
import {
  Calendar,
  ChevronRight,
  ArrowLeft,
  BookOpen,
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

type ViewMode = 'latest' | 'archive';

/**
 * 内容渲染器
 * 支持HTML（橘鸦格式）和Markdown
 */
function renderContent(content: string): string {
  // 检测是否为HTML内容（橘鸦格式）
  if (content.includes('<h2>') || content.includes('<h3>') || content.includes('<blockquote>')) {
    // 橘鸦HTML格式：添加样式类
    return content
      // h1 标题
      .replace(/<h1>(.*?)<\/h1>/g, '<h1 class="text-3xl font-bold font-display text-foreground mb-6 tracking-tight">$1</h1>')
      // h2 标题（新闻标题）- 用#N编号做锚点便于跳转
      .replace(/<h2><a href="(.*?)">(.*?)<\/a>\s*<code>#(\d+)<\/code><\/h2>/g, '<h2 id="news-$3" class="text-xl font-bold font-display text-foreground mt-10 mb-4 tracking-tight border-b border-border/30 pb-3 scroll-mt-20"><a href="$1" class="text-primary hover:underline" target="_blank" rel="noopener noreferrer">$2</a> <a href="#news-$3" class="text-muted-foreground hover:text-primary no-underline"><code class="px-1.5 py-0.5 bg-muted rounded text-sm font-mono text-primary">#$3</code></a></h2>')
      .replace(/<h2>(.*?)<code>#(\d+)<\/code><\/h2>/g, '<h2 id="news-$2" class="text-xl font-bold font-display text-foreground mt-10 mb-4 tracking-tight border-b border-border/30 pb-3 scroll-mt-20">$1 <a href="#news-$2" class="text-muted-foreground hover:text-primary no-underline"><code class="px-1.5 py-0.5 bg-muted rounded text-sm font-mono text-primary">#$2</code></a></h2>')
      // h3 标题（分类标题）
      .replace(/<h3>(.*?)<\/h3>/g, '<h3 class="text-lg font-bold font-display text-foreground mt-8 mb-3 tracking-tight text-primary">$1</h3>')
      // blockquote（引用摘要）
      .replace(/<blockquote>([\s\S]*?)<\/blockquote>/g, '<blockquote class="border-l-4 border-primary/30 pl-4 py-2 my-4 bg-primary/5 rounded-r-lg italic text-foreground/80">$1</blockquote>')
      // 段落
      .replace(/<p>(.*?)<\/p>/g, '<p class="text-[15px] text-foreground/85 leading-[1.85] mb-3">$1</p>')
      // 列表项
      .replace(/<li>(.*?)<\/li>/g, '<li class="text-[15px] text-foreground/85 leading-[1.85] mb-1 ml-4">$1</li>')
      // 无序列表
      .replace(/<ul>([\s\S]*?)<\/ul>/g, '<ul class="list-disc mb-4">$1</ul>')
      // 有序列表
      .replace(/<ol>([\s\S]*?)<\/ol>/g, '<ol class="list-decimal mb-4">$1</ol>')
      // 分隔线
      .replace(/<hr\s*\/?>/g, '<hr class="border-border/30 my-8" />')
      // 链接
      .replace(/<a href="(.*?)">(.*?)<\/a>/g, '<a href="$1" class="text-primary hover:underline" target="_blank" rel="noopener noreferrer">$2</a>')
      // 加粗
      .replace(/<strong>(.*?)<\/strong>/g, '<strong class="font-semibold text-foreground">$1</strong>')
      // 行内代码
      .replace(/<code>(.*?)<\/code>/g, '<code class="px-1.5 py-0.5 bg-muted rounded text-sm font-mono text-primary">$1</code>')
      // 图片
      .replace(/<img src="(.*?)" alt="(.*?)"\s*\/?>/g, '<img src="$1" alt="$2" class="max-w-full h-auto rounded-lg my-4 shadow-sm" />')
      .replace(/<img src="(.*?)"\s*\/?>/g, '<img src="$1" class="max-w-full h-auto rounded-lg my-4 shadow-sm" />');
  }

  // Markdown格式（兼容旧格式）
  return content
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return '<br/>';
      // ### 标题
      if (trimmed.startsWith('### ')) {
        return `<h3 class="text-lg font-bold font-display text-foreground mt-8 mb-3 tracking-tight">${trimmed.slice(4)}</h3>`;
      }
      // ## 标题
      if (trimmed.startsWith('## ')) {
        return `<h2 class="text-xl font-bold font-display text-foreground mt-10 mb-4 tracking-tight border-b border-border/30 pb-3">${trimmed.slice(3)}</h2>`;
      }
      // 加粗 **text**
      const withBold = trimmed.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>');
      // 普通段落
      return `<p class="text-[15px] text-foreground/85 leading-[1.85] mb-3">${withBold}</p>`;
    })
    .join('');
}

function DailyPageContent() {
  const [mode, setMode] = useState<ViewMode>('latest');
  const [report, setReport] = useState<DailyReport | null>(null);
  const [archiveList, setArchiveList] = useState<DailyListItem[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadLatest = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/daily');
      const json = await res.json();
      if (json.success && json.data) {
        setReport({
          ...json.data,
          hotTopics: Array.isArray(json.data.hotTopics) ? json.data.hotTopics : [],
        });
      }
    } catch (err) {
      console.error('Failed to load daily report:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadByDate = useCallback(async (date: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/daily?date=${date}`);
      const json = await res.json();
      if (json.success && json.data) {
        setReport({
          ...json.data,
          hotTopics: Array.isArray(json.data.hotTopics) ? json.data.hotTopics : [],
        });
        setSelectedDate(date);
        setMode('latest');
      }
    } catch (err) {
      console.error('Failed to load daily report by date:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadArchive = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/daily?list=true');
      const json = await res.json();
      if (json.success) {
        setArchiveList(Array.isArray(json.data) ? json.data : []);
      }
    } catch (err) {
      console.error('Failed to load archive list:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const searchParams = useSearchParams();

  useEffect(() => {
    const dateParam = searchParams.get('date');
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      loadByDate(dateParam);
    } else {
      loadLatest();
    }
  }, [loadLatest, loadByDate, searchParams]);

  // 日报加载后，滚动到highlight指定的新闻
  useEffect(() => {
    if (!report || loading) return;
    const highlight = searchParams.get('highlight');
    if (!highlight) return;

    // 等待DOM渲染后查找
    requestAnimationFrame(() => {
      const h2s = document.querySelectorAll('article h2');
      for (const h2 of h2s) {
        if (h2.textContent?.includes(highlight)) {
          h2.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // 高亮效果
          h2.classList.add('ring-2', 'ring-primary/40', 'rounded', 'transition-all');
          setTimeout(() => {
            h2.classList.remove('ring-2', 'ring-primary/40', 'rounded');
          }, 3000);
          break;
        }
      }
    });
  }, [report, loading, searchParams]);

  const handleTabChange = (m: ViewMode) => {
    setMode(m);
    if (m === 'archive') {
      loadArchive();
    } else if (!selectedDate) {
      loadLatest();
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 星期${weekdays[d.getDay()]}`;
  };

  // 加载态
  if (loading) {
    return (
      <div className="min-h-screen bg-background font-sans">
        <Navbar />
        <main className="max-w-5xl mx-auto px-8 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-muted rounded w-48" />
            <div className="h-64 bg-muted rounded" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background font-sans">
      <Navbar />
      <main className="max-w-5xl mx-auto px-8 py-8">
        {/* 顶部栏 */}
        <div className="flex items-center justify-between mb-8 border-b border-border/30 pb-6">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
              <ArrowLeft className="w-4 h-4 inline mr-1 -mt-0.5" />
              首页
            </Link>
            <span className="text-border">|</span>
            <span className="text-xs text-muted-foreground font-semibold uppercase tracking-widest">AI 日报</span>
          </div>
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            <button
              onClick={() => handleTabChange('latest')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                mode === 'latest'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
              当期日报
            </button>
            <button
              onClick={() => handleTabChange('archive')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                mode === 'archive'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
              往期
            </button>
          </div>
        </div>

        {/* 往期列表 */}
        {mode === 'archive' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {archiveList.length === 0 ? (
              <div className="col-span-full text-center py-16 text-muted-foreground text-sm">
                暂无往期日报
              </div>
            ) : (
              archiveList.map((item) => (
                <button
                  key={item.id}
                  onClick={() => loadByDate(item.reportDate)}
                  className="w-full text-left block p-5 bg-card rounded-lg border border-border/30 hover:border-primary/30 hover:shadow-sm transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">
                        {formatDate(item.reportDate)}
                      </h3>
                      {item.overview && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {item.overview.slice(0, 100)}...
                        </p>
                      )}
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

        {/* 日报文章 */}
        {mode === 'latest' && (
          <>
            {report ? (
              <article>
                {/* 日期标题 */}
                <header className="mb-8">
                  <h1 className="text-3xl font-bold font-display tracking-tight">
                    {formatDate(report.reportDate)}
                  </h1>
                  <div className="flex items-center gap-3 mt-3">
                    <span className="text-xs text-muted-foreground">
                      共 {report.newsCount} 条资讯
                    </span>
                    {report.hotTopics && report.hotTopics.length > 0 && (
                      <>
                        <span className="text-border">·</span>
                        <div className="flex flex-wrap gap-1.5">
                          {report.hotTopics.slice(0, 5).map((topic) => (
                            <span
                              key={topic}
                              className="px-2 py-0.5 text-[11px] font-medium bg-primary/8 text-primary rounded"
                            >
                              #{topic}
                            </span>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </header>

                {/* 文章正文 - 渲染橘鸦格式或Markdown */}
                {report.overview && (
                  <div
                    className="prose-custom"
                    dangerouslySetInnerHTML={{ __html: renderContent(report.overview) }}
                  />
                )}
              </article>
            ) : (
              <div className="text-center py-16">
                <p className="text-muted-foreground text-sm mb-4">暂无日报数据</p>
                <p className="text-xs text-muted-foreground">
                  可在管理后台手动生成日报
                </p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default function DailyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><p className="text-muted-foreground">加载中...</p></div>}>
      <DailyPageContent />
    </Suspense>
  );
}
