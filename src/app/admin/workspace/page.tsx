'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';
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
  Calendar,
  Activity,
} from 'lucide-react';

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
}

type LoadingState = 'juya-check' | 'daily' | 'leaderboard' | null;

export default function AdminWorkspacePage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [loadingAction, setLoadingAction] = useState<LoadingState>(null);
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 检查登录状态
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/admin/verify');
      if (res.ok) {
        setIsAuthenticated(true);
        loadStatus();
      }
    } catch {
      // 未登录
    } finally {
      setIsChecking(false);
    }
  };

  const loadStatus = async () => {
    setIsLoadingStatus(true);
    try {
      const res = await fetch('/api/admin/status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (e) {
      console.error('Failed to load status:', e);
    } finally {
      setIsLoadingStatus(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        setIsAuthenticated(true);
        loadStatus();
      } else {
        const data = await res.json();
        setLoginError(data.error || '登录失败');
      }
    } catch {
      setLoginError('网络错误');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    setIsAuthenticated(false);
    setStatus(null);
  };

  const handleSync = async (action: LoadingState) => {
    setLoadingAction(action);
    setSyncMessage(null);

    try {
      const res = await fetch('/api/admin/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      const data: SyncResult = await res.json();

      if (res.ok && data.success) {
        setSyncMessage({ type: 'success', text: data.message || '操作成功' });
        // 刷新状态
        await loadStatus();
      } else {
        setSyncMessage({ type: 'error', text: data.error || '操作失败' });
      }
    } catch {
      setSyncMessage({ type: 'error', text: '网络错误' });
    } finally {
      setLoadingAction(null);
    }
  };

  // 登录页
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
        <Navbar />
        <div className="max-w-md mx-auto mt-20 px-4">
          <Card className="border-0 shadow-lg">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Activity className="w-8 h-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">管理控制台</CardTitle>
              <p className="text-muted-foreground text-sm mt-2">请输入管理员密码登录</p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="管理员密码"
                    className="w-full px-4 py-3 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                    autoFocus
                  />
                </div>
                {loginError && (
                  <p className="text-sm text-destructive text-center">{loginError}</p>
                )}
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoggingIn || !password}
                >
                  {isLoggingIn ? <Spinner className="mr-2" /> : null}
                  {isLoggingIn ? '登录中...' : '登录'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // 加载状态
  if (isChecking || isLoadingStatus) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <Spinner className="w-8 h-8" />
            <span className="ml-3 text-muted-foreground">加载中...</span>
          </div>
        </div>
      </div>
    );
  }

  // 状态卡片配置
  const statusCards = [
    {
      label: '橘鸦 RSS',
      value: status?.juyaRssOk ? '可访问' : '不可访问',
      icon: RssIcon,
      ok: status?.juyaRssOk ?? false,
    },
    {
      label: 'Supabase',
      value: status?.supabaseOk ? '连接正常' : '连接异常',
      icon: Database,
      ok: status?.supabaseOk ?? false,
    },
    {
      label: '今日日报',
      value: status?.todayReport ? '已更新' : '等待更新',
      icon: FileText,
      ok: !!status?.todayReport,
    },
    {
      label: '新闻条数',
      value: status?.newsCount24h >= 0 ? `${status?.newsCount24h} 条` : '获取失败',
      icon: Newspaper,
      ok: (status?.newsCount24h ?? -1) >= 0,
      subtitle: '最近 24 小时',
    },
  ];

  // 操作按钮配置
  const actionButtons = [
    {
      id: 'juya-check' as const,
      label: '橘鸦同步',
      description: '采集 RSS + 生成日报',
      icon: Zap,
      color: 'bg-orange-500 hover:bg-orange-600',
    },
    {
      id: 'daily' as const,
      label: '生成日报',
      description: '仅生成日报',
      icon: Calendar,
      color: 'bg-blue-500 hover:bg-blue-600',
    },
    {
      id: 'leaderboard' as const,
      label: '更新排行榜',
      description: '抓取 DataLearner',
      icon: TrendingUp,
      color: 'bg-purple-500 hover:bg-purple-600',
    },
  ];

  // 日志状态颜色
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'text-green-500';
      case 'failed':
        return 'text-red-500';
      case 'running':
        return 'text-yellow-500';
      case 'skipped':
        return 'text-muted-foreground';
      default:
        return 'text-muted-foreground';
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-500/10 text-green-500';
      case 'failed':
        return 'bg-red-500/10 text-red-500';
      case 'running':
        return 'bg-yellow-500/10 text-yellow-500';
      case 'skipped':
        return 'bg-muted text-muted-foreground';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'juya-check':
        return '橘鸦同步';
      case 'daily':
        return '日报生成';
      case 'leaderboard':
        return '排行榜';
      case 'collect':
        return '资讯采集';
      case 'weekly':
        return '周报生成';
      default:
        return type;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* 页面标题 */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">管理控制台</h1>
            <p className="text-sm text-muted-foreground mt-1">
              系统状态监控与操作入口
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={loadStatus} disabled={isLoadingStatus}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoadingStatus ? 'animate-spin' : ''}`} />
              刷新
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              退出登录
            </Button>
          </div>
        </div>

        {/* 状态卡片 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {statusCards.map((card) => (
            <Card key={card.label} className="relative overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{card.label}</p>
                    <p className="text-xl font-semibold mt-1">{card.value}</p>
                    {card.subtitle && (
                      <p className="text-xs text-muted-foreground mt-1">{card.subtitle}</p>
                    )}
                  </div>
                  <div className={`p-2 rounded-full ${card.ok ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                    {card.ok ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-500" />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 快捷操作 */}
        <Card className="mb-8">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="w-5 h-5" />
              快捷操作
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {actionButtons.map((btn) => (
                <Button
                  key={btn.id}
                  onClick={() => handleSync(btn.id)}
                  disabled={loadingAction !== null}
                  className={`h-auto py-4 flex flex-col items-center gap-2 text-white ${btn.color}`}
                >
                  {loadingAction === btn.id ? (
                    <Spinner className="w-6 h-6" />
                  ) : (
                    <btn.icon className="w-6 h-6" />
                  )}
                  <span className="font-medium">{btn.label}</span>
                  <span className="text-xs opacity-80 font-normal">{btn.description}</span>
                </Button>
              ))}
            </div>

            {/* 消息提示 */}
            {syncMessage && (
              <div
                className={`mt-4 p-3 rounded-lg text-sm ${
                  syncMessage.type === 'success'
                    ? 'bg-green-500/10 text-green-500 border border-green-500/20'
                    : 'bg-red-500/10 text-red-500 border border-red-500/20'
                }`}
              >
                {syncMessage.type === 'success' ? (
                  <CheckCircle className="w-4 h-4 inline mr-2" />
                ) : (
                  <XCircle className="w-4 h-4 inline mr-2" />
                )}
                {syncMessage.text}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 最近日志 */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="w-5 h-5" />
              最近日志
            </CardTitle>
          </CardHeader>
          <CardContent>
            {status?.recentLogs && status.recentLogs.length > 0 ? (
              <div className="space-y-3">
                {status.recentLogs.map((log, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-sm text-muted-foreground">
                        {formatTime(log.createdAt)}
                      </div>
                      <div className="font-medium">{getTypeLabel(log.type)}</div>
                      <div className="text-sm text-muted-foreground">
                        {log.targetDate}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {log.errorMessage && (
                        <span className="text-xs text-red-500 max-w-48 truncate" title={log.errorMessage}>
                          {log.errorMessage}
                        </span>
                      )}
                      <Badge className={`${getStatusBg(log.status)} border-0`}>
                        {log.status === 'success' ? '成功' :
                         log.status === 'failed' ? '失败' :
                         log.status === 'running' ? '运行中' :
                         log.status === 'skipped' ? '跳过' : log.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>暂无日志记录</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// 简单的 RSS 图标组件
function RssIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 11a9 10 0 0 1 9 10" />
      <path d="M4 4a16 16 0 0 1 16 16" />
      <circle cx="5" cy="19" r="1" />
    </svg>
  );
}
