'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import {
  CheckCircle,
  XCircle,
  Clock,
  Newspaper,
  Database,
  RefreshCw,
  FileText,
  TrendingUp,
  Zap,
  AlertCircle,
  Loader2,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────

interface SystemStatus {
  supabaseOk: boolean;
  todayReport: { id: string; report_date: string } | null;
  latestReportDate: string | null;
  newsCount24h: number;
  leaderboardCount: number;
  recentLogs: Array<{
    type: string;
    targetDate: string;
    status: string;
    createdAt: string;
    errorMessage?: string;
  }>;
  juyaRssOk: boolean;
}

interface SyncResult {
  success: boolean;
  action: string;
  message?: string;
  error?: string;
  detail?: string;
}

type LoadingState = 'juya-check' | 'daily' | 'leaderboard' | null;

// ─── Page Component ──────────────────────────────────────────────────

export default function AdminWorkspacePage() {
  const router = useRouter();

  // Auth state
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Status state
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);

  // Sync state
  const [syncing, setSyncing] = useState<LoadingState>(null);
  const [messages, setMessages] = useState<Array<{ text: string; success: boolean; time: string }>>([]);

  // ─── Auth ────────────────────────────────────────────────────────

  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/verify');
      if (res.ok) setAuthenticated(true);
    } catch { /* not authenticated */ }
  }, []);

  useEffect(() => { checkAuth(); }, [checkAuth]);

  useEffect(() => {
    if (authenticated) loadStatus();
  }, [authenticated]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        setAuthenticated(true);
        setPassword('');
      } else {
        const data = await res.json();
        setAuthError(data.error || '登录失败');
      }
    } catch {
      setAuthError('网络错误');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    setAuthenticated(false);
    setStatus(null);
  };

  // ─── Status ──────────────────────────────────────────────────────

  const loadStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const res = await fetch('/api/admin/status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (err) {
      console.error('Failed to load status:', err);
    } finally {
      setStatusLoading(false);
    }
  }, []);

  // ─── Sync Actions ──────────────────────────────────────────────

  const handleSync = async (action: LoadingState) => {
    if (!action) return;
    setSyncing(action);
    try {
      const res = await fetch('/api/admin/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data: SyncResult = await res.json();
      const now = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setMessages(prev => [{
        text: data.message || data.error || (data.success ? '操作成功' : '操作失败'),
        success: data.success,
        time: now,
      }, ...prev].slice(0, 10));
      // 刷新状态
      await loadStatus();
    } catch (err) {
      const now = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setMessages(prev => [{
        text: '网络请求失败',
        success: false,
        time: now,
      }, ...prev].slice(0, 10));
    } finally {
      setSyncing(null);
    }
  };

  // ─── Helpers ──────────────────────────────────────────────────────

  const formatLogTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('zh-CN', {
        month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  const typeLabels: Record<string, string> = {
    'juya-check': '橘鸦同步',
    'daily': '日报生成',
    'leaderboard': '排行榜',
    'collect': '资讯采集',
    'daily-sync': '每日同步',
    'rss-collect': 'RSS采集',
  };

  const statusColors: Record<string, string> = {
    success: 'text-emerald-600 bg-emerald-500/10',
    failed: 'text-red-600 bg-red-500/10',
    running: 'text-amber-600 bg-amber-500/10',
    skipped: 'text-gray-500 bg-gray-500/10',
    no_content: 'text-gray-500 bg-gray-500/10',
    empty: 'text-gray-500 bg-gray-500/10',
  };

  const statusLabels: Record<string, string> = {
    success: '成功',
    failed: '失败',
    running: '运行中',
    skipped: '已跳过',
    no_content: '无内容',
    empty: '空',
  };

  // ─── Login Page ───────────────────────────────────────────────────

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-background font-sans">
        <Navbar />
        <div className="max-w-sm mx-auto px-4 py-20">
          <div className="bg-card rounded-xl border border-border p-8">
            <div className="text-center mb-6">
              <Zap className="w-10 h-10 text-primary mx-auto mb-3" />
              <h1 className="text-xl font-bold text-foreground">AI Pulse 控制台</h1>
              <p className="text-sm text-muted-foreground mt-1">请输入管理密码</p>
            </div>
            <form onSubmit={handleLogin} className="space-y-4">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="管理密码"
                className="w-full px-4 py-2.5 text-sm border border-border rounded-lg bg-muted text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                autoFocus
              />
              {authError && (
                <p className="text-xs text-red-500 text-center">{authError}</p>
              )}
              <button
                type="submit"
                disabled={authLoading || !password}
                className="w-full px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {authLoading ? '验证中...' : '登录'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ─── Console Page ──────────────────────────────────────────────────

  const today = new Date().toISOString().split('T')[0];
  const todayUpdated = status?.todayReport?.report_date === today;

  return (
    <div className="min-h-screen bg-background font-sans">
      <Navbar />
      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold font-display text-foreground">控制台</h1>
            <p className="text-sm text-muted-foreground mt-1">系统状态与快捷操作</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-xs text-muted-foreground hover:text-foreground border border-border px-3 py-1.5 rounded-md transition-colors"
          >
            退出登录
          </button>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {/* 橘鸦RSS */}
          <div className="bg-card rounded-lg border border-border/50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Newspaper className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">橘鸦RSS</span>
            </div>
            {statusLoading ? (
              <div className="h-5 w-16 bg-muted rounded animate-pulse" />
            ) : (
              <div className="flex items-center gap-1.5">
                {status?.juyaRssOk ? (
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-500" />
                )}
                <span className={`text-sm font-medium ${status?.juyaRssOk ? 'text-emerald-600' : 'text-red-600'}`}>
                  {status?.juyaRssOk ? '可访问' : '不可访问'}
                </span>
              </div>
            )}
          </div>

          {/* Supabase */}
          <div className="bg-card rounded-lg border border-border/50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Database className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Supabase</span>
            </div>
            {statusLoading ? (
              <div className="h-5 w-16 bg-muted rounded animate-pulse" />
            ) : (
              <div className="flex items-center gap-1.5">
                {status?.supabaseOk ? (
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-500" />
                )}
                <span className={`text-sm font-medium ${status?.supabaseOk ? 'text-emerald-600' : 'text-red-600'}`}>
                  {status?.supabaseOk ? '正常' : '异常'}
                </span>
              </div>
            )}
          </div>

          {/* 今日日报 */}
          <div className="bg-card rounded-lg border border-border/50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">今日日报</span>
            </div>
            {statusLoading ? (
              <div className="h-5 w-16 bg-muted rounded animate-pulse" />
            ) : (
              <div className="flex items-center gap-1.5">
                {todayUpdated ? (
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                ) : (
                  <Clock className="w-4 h-4 text-amber-500" />
                )}
                <span className={`text-sm font-medium ${todayUpdated ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {todayUpdated ? '已更新' : '等待更新'}
                </span>
              </div>
            )}
          </div>

          {/* 新闻条数 */}
          <div className="bg-card rounded-lg border border-border/50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">24h资讯</span>
            </div>
            {statusLoading ? (
              <div className="h-5 w-10 bg-muted rounded animate-pulse" />
            ) : (
              <span className="text-lg font-bold text-foreground">
                {status?.newsCount24h ?? -1 >= 0 ? status?.newsCount24h : '—'}
              </span>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">快捷操作</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              onClick={() => handleSync('juya-check')}
              disabled={syncing !== null}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {syncing === 'juya-check' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              {syncing === 'juya-check' ? '同步中...' : '橘鸦同步'}
            </button>
            <button
              onClick={() => handleSync('daily')}
              disabled={syncing !== null}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-card border border-border rounded-lg text-sm font-medium text-foreground hover:border-primary/40 transition-colors disabled:opacity-50"
            >
              {syncing === 'daily' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
              {syncing === 'daily' ? '生成中...' : '生成日报'}
            </button>
            <button
              onClick={() => handleSync('leaderboard')}
              disabled={syncing !== null}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-card border border-border rounded-lg text-sm font-medium text-foreground hover:border-primary/40 transition-colors disabled:opacity-50"
            >
              {syncing === 'leaderboard' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <TrendingUp className="w-4 h-4" />
              )}
              {syncing === 'leaderboard' ? '更新中...' : '更新排行榜'}
            </button>
          </div>
        </div>

        {/* Messages */}
        {messages.length > 0 && (
          <div className="mb-8 space-y-2">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex items-start gap-2 px-4 py-3 rounded-lg border text-sm ${
                  msg.success
                    ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-700'
                    : 'bg-red-500/5 border-red-500/20 text-red-700'
                }`}
              >
                {msg.success ? (
                  <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                )}
                <span className="flex-1">{msg.text}</span>
                <span className="text-xs opacity-60 shrink-0">{msg.time}</span>
              </div>
            ))}
          </div>
        )}

        {/* Recent Logs */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">最近日志</h2>
            <button
              onClick={loadStatus}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              刷新
            </button>
          </div>

          {statusLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />
              ))}
            </div>
          ) : !status?.recentLogs || status.recentLogs.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              暂无日志记录
            </div>
          ) : (
            <div className="space-y-2">
              {status.recentLogs.map((log, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 px-4 py-3 bg-card rounded-lg border border-border/30"
                >
                  <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${statusColors[log.status] || 'text-gray-500 bg-gray-500/10'}`}>
                    {statusLabels[log.status] || log.status}
                  </span>
                  <span className="text-sm text-foreground">
                    {typeLabels[log.type] || log.type}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {log.targetDate}
                  </span>
                  {log.errorMessage && (
                    <span className="text-xs text-red-500 truncate flex-1 text-right">
                      {log.errorMessage}
                    </span>
                  )}
                  <span className="text-[11px] text-muted-foreground shrink-0 ml-auto">
                    {formatLogTime(log.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Extra info */}
        <div className="mt-8 pt-6 border-t border-border/30">
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <span>排行榜: {status?.leaderboardCount ?? '—'} 条</span>
            <span>最新日报: {status?.latestReportDate ?? '无'}</span>
            <span>Supabase: {status?.supabaseOk ? '✓' : '✗'}</span>
            <span>RSS: {status?.juyaRssOk ? '✓' : '✗'}</span>
          </div>
        </div>
      </main>
    </div>
  );
}
