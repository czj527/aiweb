'use client';

import { useState, useEffect, useCallback } from 'react';
import { Navbar } from '@/components/navbar';

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

interface GenerateResult {
  success: boolean;
  message?: string;
  error?: string;
  newsCount?: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  model: '大模型',
  agent: 'AI Agent',
  opensource: '开源',
  product: '产品',
  policy: '政策',
  research: '研究',
  industry: '行业',
};

const LEVEL_COLORS: Record<string, string> = {
  SSS: 'bg-red-100 text-red-800',
  SS: 'bg-orange-100 text-orange-800',
  S: 'bg-yellow-100 text-yellow-800',
  A: 'bg-blue-100 text-blue-800',
};

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [generating, setGenerating] = useState<'collect' | 'daily' | 'weekly' | 'leaderboard' | null>(null);
  const [generateResult, setGenerateResult] = useState<GenerateResult | null>(null);
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterLevel, setFilterLevel] = useState('all');

  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/verify');
      if (res.ok) {
        setAuthenticated(true);
      }
    } catch {
      // not authenticated
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (authenticated) {
      loadNews();
    }
  }, [authenticated]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (data.success) {
        setAuthenticated(true);
        setPassword('');
      } else {
        setAuthError(data.error || '密码错误');
      }
    } catch {
      setAuthError('登录失败，请重试');
    }
  };

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    setAuthenticated(false);
    setNews([]);
  };

  const loadNews = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/news');
      const data = await res.json();
      if (data.success) {
        // data.data = { items: NewsItemRow[], total: number }
        const result = data.data;
        setNews(Array.isArray(result) ? result : result?.items || []);
      }
    } catch (err) {
      console.error('加载新闻失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const deleteNews = async (id: string) => {
    if (!confirm('确定删除这条新闻？此操作不可恢复。')) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/admin/news?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setNews(prev => prev.filter(n => n.id !== id));
      } else {
        alert(data.error || '删除失败');
      }
    } catch {
      alert('删除失败，请重试');
    } finally {
      setDeleting(null);
    }
  };

  const triggerGenerate = async (type: 'collect' | 'daily' | 'weekly' | 'leaderboard') => {
    setGenerating(type);
    setGenerateResult(null);
    try {
      let url = '';
      if (type === 'collect') url = '/api/news/collect';
      else if (type === 'daily') url = '/api/daily/generate';
      else if (type === 'weekly') url = '/api/weekly/generate';
      else url = '/api/leaderboard/fetch';

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: type === 'leaderboard' ? JSON.stringify({ source: 'datalearner-aa' }) : undefined,
      });
      const data = await res.json();
      setGenerateResult({
        success: data.success ?? res.ok,
        message: data.message || data.overview?.slice(0, 100) || data.error,
        error: data.error,
        newsCount: data.newsCount || data.data?.newsCount,
      });
      if (type === 'collect' || type === 'daily') {
        await loadNews();
      }
    } catch (err) {
      setGenerateResult({ success: false, error: '请求失败，请重试' });
    } finally {
      setGenerating(null);
    }
  };

  const filteredNews = news.filter(n => {
    if (filterCategory !== 'all' && n.category !== filterCategory) return false;
    if (filterLevel !== 'all' && n.importanceLevel !== filterLevel) return false;
    return true;
  });

  // Login page
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="max-w-md mx-auto px-4 py-24">
          <div className="bg-card rounded-lg border border-border p-8">
            <h1 className="text-2xl font-bold text-foreground mb-2">管理员登录</h1>
            <p className="text-muted-foreground text-sm mb-6">输入密码以访问管理后台</p>
            <form onSubmit={handleLogin}>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="请输入管理密码"
                className="w-full px-4 py-3 rounded-md border border-border bg-muted text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 mb-4"
                autoFocus
              />
              {authError && (
                <p className="text-destructive text-sm mb-4">{authError}</p>
              )}
              <button
                type="submit"
                className="w-full py-3 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors"
              >
                登录
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Admin dashboard
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">管理后台</h1>
            <p className="text-muted-foreground text-sm mt-1">管理新闻数据、手动触发内容生成</p>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-sm border border-border rounded-md text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
          >
            退出登录
          </button>
        </div>

        {/* Generate actions */}
        <div className="bg-card rounded-lg border border-border p-6 mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">手动触发生成</h2>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => triggerGenerate('collect')}
              disabled={generating !== null}
              className="px-5 py-2.5 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generating === 'collect' ? '收集中...' : '收集资讯'}
            </button>
            <button
              onClick={() => triggerGenerate('daily')}
              disabled={generating !== null}
              className="px-5 py-2.5 bg-muted text-foreground rounded-md font-medium hover:bg-muted/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generating === 'daily' ? '生成中...' : '生成日报'}
            </button>
            <button
              onClick={() => triggerGenerate('weekly')}
              disabled={generating !== null}
              className="px-5 py-2.5 bg-muted text-foreground rounded-md font-medium hover:bg-muted/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generating === 'weekly' ? '生成中...' : '生成周报'}
            </button>
            <button
              onClick={() => triggerGenerate('leaderboard')}
              disabled={generating !== null}
              className="px-5 py-2.5 bg-muted text-foreground rounded-md font-medium hover:bg-muted/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generating === 'leaderboard' ? '更新中...' : '更新排行榜'}
            </button>
          </div>
          {generateResult && (
            <div className={`mt-4 p-3 rounded-md text-sm ${generateResult.success ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
              {generateResult.success
                ? `操作成功${generateResult.newsCount ? `，共 ${generateResult.newsCount} 条新闻` : ''}${generateResult.message ? ` — ${generateResult.message}` : ''}`
                : `操作失败: ${generateResult.error || '未知错误'}`}
            </div>
          )}
          <p className="text-muted-foreground text-xs mt-3">
            提示: 「收集资讯」仅搜索和入库新闻，不生成日报；「生成日报」会在已有新闻基础上生成AI日报文章。收集需要1-3分钟。
          </p>
        </div>

        {/* News management */}
        <div className="bg-card rounded-lg border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">
              新闻管理
              <span className="text-muted-foreground font-normal text-sm ml-2">
                共 {filteredNews.length} 条
                {filterCategory !== 'all' || filterLevel !== 'all' ? ' (已筛选)' : ''}
              </span>
            </h2>
            <button
              onClick={loadNews}
              disabled={loading}
              className="px-3 py-1.5 text-sm border border-border rounded-md text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              {loading ? '加载中...' : '刷新'}
            </button>
          </div>

          {/* Filters */}
          <div className="flex gap-3 mb-4">
            <select
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
              className="px-3 py-1.5 text-sm border border-border rounded-md bg-muted text-foreground"
            >
              <option value="all">全部分类</option>
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <select
              value={filterLevel}
              onChange={e => setFilterLevel(e.target.value)}
              className="px-3 py-1.5 text-sm border border-border rounded-md bg-muted text-foreground"
            >
              <option value="all">全部级别</option>
              <option value="SSS">SSS</option>
              <option value="SS">SS</option>
              <option value="S">S</option>
              <option value="A">A</option>
            </select>
          </div>

          {/* News list */}
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">加载中...</div>
          ) : filteredNews.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">暂无新闻数据</div>
          ) : (
            <div className="space-y-2">
              {filteredNews.map((item, idx) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 p-3 rounded-md border border-border hover:bg-muted/50 transition-colors"
                >
                  {/* Rank */}
                  <span className="text-muted-foreground text-sm font-mono w-6 text-right shrink-0 pt-0.5">
                    {idx + 1}
                  </span>
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2">
                      <h3 className="text-foreground text-sm font-medium leading-snug line-clamp-2">
                        {item.title}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${LEVEL_COLORS[item.importanceLevel] || 'bg-muted text-muted-foreground'}`}>
                        {item.importanceLevel}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {CATEGORY_LABELS[item.category] || item.category}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        来源: {item.source}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        分数: {item.importanceScore}
                      </span>
                      {item.keywords?.length > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {item.keywords.slice(0, 3).join('、')}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Delete button */}
                  <button
                    onClick={() => deleteNews(item.id)}
                    disabled={deleting === item.id}
                    className="px-3 py-1 text-xs border border-destructive/30 text-destructive rounded hover:bg-destructive/10 transition-colors disabled:opacity-50 shrink-0"
                  >
                    {deleting === item.id ? '删除中...' : '删除'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
