'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/navbar';
import {
  Bot,
  Send,
  ArrowLeft,
  Newspaper,
  CheckCircle,
  Clock,
  Calendar,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Terminal,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────

interface Stats {
  totalNews: number;
  publishedNews: number;
  pendingNews: number;
  totalDailyReports: number;
  totalWeeklyReports: number;
}

interface GenerationLog {
  id: string;
  type: string;
  target_date: string;
  status: string;
  discovered_count: number;
  after_dedup_count: number;
  after_filter_count: number;
  error_message?: string;
  started_at: string;
  completed_at?: string;
}

interface RecentNews {
  id: string;
  title: string;
  category: string;
  importance_level: string;
  source_name: string;
  published_at: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  actionResult?: { success: boolean; message: string };
  isLoading?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  model: '大模型',
  agent: 'AI Agent',
  opensource: '开源',
  product: '产品',
  policy: '政策',
  research: '研究',
  industry: '行业',
};

const LOG_TYPE_LABELS: Record<string, string> = {
  collect: '资讯收集',
  daily: '日报生成',
  weekly: '周报生成',
};

const LOG_STATUS_LABELS: Record<string, string> = {
  running: '运行中',
  success: '成功',
  failed: '失败',
};

function formatTime(dateStr?: string) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ─── Page Component ──────────────────────────────────────────────────

export default function WorkspacePage() {
  // Auth state
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Dashboard state
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentLogs, setRecentLogs] = useState<GenerationLog[]>([]);
  const [recentNews, setRecentNews] = useState<RecentNews[]>([]);
  const [dashboardLoading, setDashboardLoading] = useState(true);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Quick actions state
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // ─── Auth ────────────────────────────────────────────────────────

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
      loadDashboard();
    }
  }, [authenticated]);

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
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
    } finally {
      setAuthLoading(false);
    }
  };

  // ─── Dashboard Data ──────────────────────────────────────────────

  const loadDashboard = async () => {
    setDashboardLoading(true);
    try {
      const res = await fetch('/api/admin/ai/status');
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
        setRecentLogs(data.recentLogs ?? []);
        setRecentNews(data.recentNews ?? []);
      }
    } catch (err) {
      console.error('加载仪表盘失败:', err);
    } finally {
      setDashboardLoading(false);
    }
  };

  // ─── Quick Actions ───────────────────────────────────────────────

  const triggerAction = async (type: string) => {
    setActionLoading(type);
    try {
      let url = '';
      let body: Record<string, unknown> | undefined;
      if (type === 'collect') url = '/api/news/collect';
      else if (type === 'daily') url = '/api/daily/generate';
      else if (type === 'weekly') url = '/api/weekly/generate';
      else {
        url = '/api/leaderboard/fetch';
        body = { source: 'datalearner-aa' };
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      const success = data.success ?? res.ok;

      // Add as system message in chat
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: '',
          actionResult: {
            success,
            message: success
              ? `「${getActionLabel(type)}」执行成功${data.newsCount ? `，共 ${data.newsCount} 条` : ''}`
              : `「${getActionLabel(type)}」执行失败: ${data.error || '未知错误'}`,
          },
        },
      ]);

      // Refresh dashboard
      await loadDashboard();
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: '',
          actionResult: { success: false, message: `「${getActionLabel(type)}」请求失败` },
        },
      ]);
    } finally {
      setActionLoading(null);
    }
  };

  function getActionLabel(type: string) {
    const map: Record<string, string> = {
      collect: '收集资讯',
      daily: '生成日报',
      weekly: '生成周报',
      leaderboard: '更新排行榜',
    };
    return map[type] ?? type;
  }

  // ─── Chat ────────────────────────────────────────────────────────

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || chatLoading) return;

    const userMsg: ChatMessage = { role: 'user', content: text };
    const assistantMsg: ChatMessage = { role: 'assistant', content: '', isLoading: true };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput('');
    setChatLoading(true);

    try {
      // Build conversation history for multi-turn
      const history = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch('/api/admin/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No reader');

      const decoder = new TextDecoder();
      let assistantContent = '';
      let actionResult: ChatMessage['actionResult'] = undefined;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr || jsonStr === '[DONE]') continue;

          try {
            const event = JSON.parse(jsonStr);

            if (event.type === 'content' && event.content) {
              assistantContent += event.content;
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last && last.role === 'assistant') {
                  last.content = assistantContent;
                  last.isLoading = false;
                }
                return updated;
              });
            } else if (event.type === 'action_start') {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last && last.role === 'assistant') {
                  last.isLoading = true;
                }
                return updated;
              });
            } else if (event.type === 'action_result') {
              actionResult = {
                success: event.success ?? false,
                message: event.message ?? '',
              };
            } else if (event.type === 'done') {
              // Finalize
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }

      // Final update
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last && last.role === 'assistant') {
          last.content = assistantContent || '(无回复)';
          last.isLoading = false;
          if (actionResult) last.actionResult = actionResult;
        }
        return updated;
      });

      // Refresh dashboard after any action
      if (actionResult) {
        await loadDashboard();
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : '请求失败';
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last && last.role === 'assistant') {
          last.content = `请求出错: ${errMsg}`;
          last.isLoading = false;
        }
        return updated;
      });
    } finally {
      setChatLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ─── Login Page ──────────────────────────────────────────────────

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="max-w-md mx-auto px-4 py-24">
          <div className="bg-card rounded-lg border border-border p-8">
            <div className="flex items-center gap-3 mb-2">
              <Bot className="w-6 h-6 text-primary" />
              <h1 className="text-2xl font-bold text-foreground">AI 工作台</h1>
            </div>
            <p className="text-muted-foreground text-sm mb-6">输入密码以访问 AI 管理工作台</p>
            <form onSubmit={handleLogin}>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入管理密码"
                className="w-full px-4 py-3 rounded-md border border-border bg-muted text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 mb-4"
                autoFocus
              />
              {authError && <p className="text-destructive text-sm mb-4">{authError}</p>}
              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-3 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {authLoading ? '登录中...' : '登录'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ─── Workspace ───────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ─── LEFT: AI Chat Panel (col-span-2) ─────────────── */}
          <div className="lg:col-span-2 flex flex-col bg-card rounded-lg border border-border" style={{ height: 'calc(100vh - 140px)' }}>
            {/* Chat Header */}
            <div className="flex items-center gap-2.5 px-5 py-4 border-b border-border shrink-0">
              <Bot className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">AI 管理助手</h2>
              <span className="text-xs text-muted-foreground ml-2">可以问我任何关于站点的问题，或让我执行操作</span>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Bot className="w-12 h-12 mb-4 opacity-30" />
                  <p className="text-sm">你好！我是 AI Pulse 管理助手</p>
                  <p className="text-xs mt-1">你可以让我查看数据、收集资讯、生成日报等</p>
                  <div className="flex flex-wrap gap-2 mt-4">
                    {['查看系统状态', '最近有什么新闻？', '今天待审核的新闻有多少？'].map((q) => (
                      <button
                        key={q}
                        onClick={() => {
                          setInput(q);
                        }}
                        className="px-3 py-1.5 text-xs bg-muted text-muted-foreground rounded-md hover:text-foreground hover:bg-muted/80 transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] ${msg.role === 'user' ? 'order-1' : 'order-1'}`}>
                    {msg.role === 'user' ? (
                      <div className="bg-primary text-primary-foreground px-4 py-2.5 rounded-lg rounded-br-sm text-sm leading-relaxed whitespace-pre-wrap">
                        {msg.content}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {/* Action result card */}
                        {msg.actionResult && (
                          <div
                            className={`flex items-start gap-2 px-4 py-3 rounded-lg border text-sm ${
                              msg.actionResult.success
                                ? 'bg-green-50 border-green-200 text-green-800'
                                : 'bg-red-50 border-red-200 text-red-800'
                            }`}
                          >
                            {msg.actionResult.success ? (
                              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                            ) : (
                              <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                            )}
                            <span>{msg.actionResult.message}</span>
                          </div>
                        )}
                        {/* Assistant text content */}
                        {msg.content && (
                          <div className="bg-card border border-border px-4 py-2.5 rounded-lg rounded-bl-sm text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                            {msg.isLoading && !msg.content ? (
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>思考中...</span>
                              </div>
                            ) : (
                              msg.content
                            )}
                          </div>
                        )}
                        {/* Loading indicator */}
                        {msg.isLoading && !msg.content && !msg.actionResult && (
                          <div className="bg-card border border-border px-4 py-2.5 rounded-lg rounded-bl-sm text-sm">
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>AI 正在处理...</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="px-5 py-4 border-t border-border shrink-0">
              <div className="flex gap-3">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="输入消息... (Enter 发送, Shift+Enter 换行)"
                  rows={2}
                  className="flex-1 px-4 py-2.5 text-sm border border-border rounded-lg bg-muted text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
                <button
                  onClick={sendMessage}
                  disabled={chatLoading || !input.trim()}
                  className="px-4 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed self-end"
                >
                  {chatLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>

          {/* ─── RIGHT: Dashboard (col-span-1) ────────────────── */}
          <div className="space-y-5">
            {/* Back Link */}
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              返回管理后台
            </Link>

            {/* Stats Cards (2x2) */}
            {dashboardLoading ? (
              <div className="grid grid-cols-2 gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="bg-card rounded-lg border border-border p-4 animate-pulse">
                    <div className="h-4 bg-muted rounded w-16 mb-2" />
                    <div className="h-7 bg-muted rounded w-12" />
                  </div>
                ))}
              </div>
            ) : stats ? (
              <div className="grid grid-cols-2 gap-3">
                {/* Total News */}
                <div className="bg-card rounded-lg border border-border p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Newspaper className="w-4 h-4" />
                    <span className="text-xs">全部新闻</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">{stats.totalNews}</p>
                </div>
                {/* Published */}
                <div className="bg-card rounded-lg border border-border p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-xs">已发布</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">{stats.publishedNews}</p>
                </div>
                {/* Pending */}
                <div className={`bg-card rounded-lg border p-4 ${stats.pendingNews > 0 ? 'border-yellow-300 bg-yellow-50/50' : 'border-border'}`}>
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Clock className="w-4 h-4" />
                    <span className="text-xs">待审核</span>
                  </div>
                  <p className={`text-2xl font-bold ${stats.pendingNews > 0 ? 'text-yellow-700' : 'text-foreground'}`}>
                    {stats.pendingNews}
                  </p>
                </div>
                {/* Reports */}
                <div className="bg-card rounded-lg border border-border p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Calendar className="w-4 h-4" />
                    <span className="text-xs">日报/周报</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">
                    {stats.totalDailyReports}/{stats.totalWeeklyReports}
                  </p>
                </div>
              </div>
            ) : null}

            {/* Quick Actions */}
            <div className="bg-card rounded-lg border border-border p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">快捷操作</h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { type: 'collect', label: '收集资讯', icon: Newspaper },
                  { type: 'daily', label: '生成日报', icon: Calendar },
                  { type: 'weekly', label: '生成周报', icon: Calendar },
                  { type: 'leaderboard', label: '更新排行榜', icon: Terminal },
                ].map(({ type, label, icon: Icon }) => (
                  <button
                    key={type}
                    onClick={() => triggerAction(type)}
                    disabled={actionLoading !== null}
                    className="flex items-center justify-center gap-2 px-3 py-2.5 text-sm bg-muted text-foreground rounded-md hover:bg-muted/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {actionLoading === type ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Icon className="w-4 h-4" />
                    )}
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-card rounded-lg border border-border p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">最近活动</h3>
              {recentLogs.length === 0 ? (
                <p className="text-xs text-muted-foreground">暂无活动记录</p>
              ) : (
                <div className="space-y-2.5">
                  {recentLogs.map((log) => (
                    <div key={log.id} className="flex items-start gap-2.5 text-xs">
                      <div className="mt-0.5">
                        {log.status === 'success' ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                        ) : log.status === 'failed' ? (
                          <XCircle className="w-3.5 h-3.5 text-red-600" />
                        ) : (
                          <AlertCircle className="w-3.5 h-3.5 text-yellow-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-foreground">
                            {LOG_TYPE_LABELS[log.type] ?? log.type}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] ${
                              log.status === 'success'
                                ? 'bg-green-100 text-green-700'
                                : log.status === 'failed'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-yellow-100 text-yellow-700'
                            }`}
                          >
                            {LOG_STATUS_LABELS[log.status] ?? log.status}
                          </span>
                        </div>
                        <p className="text-muted-foreground mt-0.5">
                          {log.target_date} · 发现 {log.discovered_count ?? 0} · 入库 {log.after_filter_count ?? 0}
                        </p>
                      </div>
                      <span className="text-muted-foreground shrink-0">{formatTime(log.started_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent News */}
            <div className="bg-card rounded-lg border border-border p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">最新新闻</h3>
              {recentNews.length === 0 ? (
                <p className="text-xs text-muted-foreground">暂无新闻</p>
              ) : (
                <div className="space-y-2.5">
                  {recentNews.map((news) => (
                    <div key={news.id} className="flex items-start gap-2 text-xs">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono shrink-0 ${
                          news.importance_level === 'SSS'
                            ? 'bg-red-100 text-red-800'
                            : news.importance_level === 'SS'
                              ? 'bg-orange-100 text-orange-800'
                              : news.importance_level === 'S'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {news.importance_level}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-foreground font-medium leading-snug line-clamp-2">{news.title}</p>
                        <p className="text-muted-foreground mt-0.5">
                          {CATEGORY_LABELS[news.category] ?? news.category} · {news.source_name ?? '未知'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
