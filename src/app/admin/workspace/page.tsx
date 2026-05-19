'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Navbar } from '@/components/navbar';
import {
  Bot,
  Send,
  Loader2,
  CheckCircle2,
  XCircle,
  Newspaper,
  Calendar,
  Terminal,
  Brain,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Edit3,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────

interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source_name: string;
  source?: string;
  sourceUrl: string;
  source_url: string;
  category: string;
  importance_score: number;
  importanceScore: number;
  importance_level: string;
  importanceLevel: string;
  keywords: string[];
  published_at: string;
  publishedAt: string;
  status?: string;
  reject_reason?: string;
}

interface GenerateResult {
  success: boolean;
  message?: string;
  error?: string;
  newsCount?: number;
}

interface CollectLog {
  type: 'info' | 'step' | 'success' | 'error' | 'stats';
  message: string;
  timestamp: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  actionResult?: { success: boolean; message: string };
  isLoading?: boolean;
}

interface AiMemory {
  id: string;
  key: string;
  value: string;
  category: string;
  created_at: string;
  updated_at: string;
}

// Persisted shape (no ephemeral isLoading)
interface PersistedChatMessage {
  role: 'user' | 'assistant';
  content: string;
  actionResult?: { success: boolean; message: string };
}

const CHAT_STORAGE_KEY = 'ai-pulse-chat-messages';

// ─── Constants ───────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  model: '大模型',
  agent: 'AI Agent',
  opensource: '开源',
  product: '产品',
  policy: '政策',
  research: '研究',
  industry: '行业',
  rumor: '前瞻与传闻',
};

const LEVEL_COLORS: Record<string, string> = {
  SSS: 'bg-red-100 text-red-800',
  SS: 'bg-orange-100 text-orange-800',
  S: 'bg-yellow-100 text-yellow-800',
  A: 'bg-blue-100 text-blue-800',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  published: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

const STATUS_LABELS: Record<string, string> = {
  pending: '待审核',
  published: '已发布',
  rejected: '已拒绝',
};

type TabType = 'all' | 'pending' | 'published' | 'rejected';
type MobileTab = 'admin' | 'chat';

// ─── Page Component ──────────────────────────────────────────────────

export default function WorkspacePage() {
  // Auth state
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Mobile tab
  const [mobileTab, setMobileTab] = useState<MobileTab>('admin');

  // Admin state
  const [news, setNews] = useState<NewsItem[]>([]);
  const [pendingNews, setPendingNews] = useState<NewsItem[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [generating, setGenerating] = useState<'collect' | 'daily' | 'weekly' | 'leaderboard' | 'daily-sync' | null>(null);
  const [generateResult, setGenerateResult] = useState<GenerateResult | null>(null);
  const [collectLogs, setCollectLogs] = useState<CollectLog[]>([]);
  const [collectStreaming, setCollectStreaming] = useState(false);
  const collectAbortRef = useRef<AbortController | null>(null);
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterLevel, setFilterLevel] = useState('all');
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [reviewing, setReviewing] = useState(false);
  const [editingItem, setEditingItem] = useState<NewsItem | null>(null);
  const [editForm, setEditForm] = useState({ title: '', summary: '', category: '', importanceScore: 0 });
  const [rejectReasonInput, setRejectReasonInput] = useState('');

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const stored = localStorage.getItem(CHAT_STORAGE_KEY);
      if (stored) {
        const parsed: PersistedChatMessage[] = JSON.parse(stored);
        return parsed.map(m => ({ ...m, isLoading: false }));
      }
    } catch { /* ignore */ }
    return [];
  });
  const [input, setInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Memory state
  const [memories, setMemories] = useState<AiMemory[]>([]);
  const [memoryPanelOpen, setMemoryPanelOpen] = useState(false);
  const [memoryLoading, setMemoryLoading] = useState(false);
  const [newMemory, setNewMemory] = useState({ key: '', value: '', category: 'general' });
  const [addingMemory, setAddingMemory] = useState(false);
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null);
  const [editMemoryForm, setEditMemoryForm] = useState({ key: '', value: '', category: 'general' });

  // ─── Auth ────────────────────────────────────────────────────────

  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/verify');
      if (res.ok) setAuthenticated(true);
    } catch { /* not authenticated */ }
  }, []);

  useEffect(() => { checkAuth(); }, [checkAuth]);

  useEffect(() => {
    if (authenticated) {
      loadNews();
      loadPending();
    }
  }, [authenticated]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Persist messages to localStorage (debounced, strip isLoading)
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      try {
        const toSave: PersistedChatMessage[] = messages.map(m => ({
          role: m.role,
          content: m.content,
          ...(m.actionResult ? { actionResult: m.actionResult } : {}),
        }));
        localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(toSave));
      } catch { /* quota exceeded, ignore */ }
    }, 500);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [messages]);

  const clearChatHistory = () => {
    setMessages([]);
    try { localStorage.removeItem(CHAT_STORAGE_KEY); } catch { /* ignore */ }
  };

  // ─── Memory CRUD ───────────────────────────────────────────────

  const loadMemories = async () => {
    setMemoryLoading(true);
    try {
      const res = await fetch('/api/admin/ai/memory');
      const data = await res.json();
      if (data.success) setMemories(data.data || []);
    } catch (err) { console.error('加载记忆失败:', err); }
    finally { setMemoryLoading(false); }
  };

  const addMemory = async () => {
    if (!newMemory.key.trim() || !newMemory.value.trim()) return;
    setAddingMemory(true);
    try {
      const res = await fetch('/api/admin/ai/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMemory),
      });
      const data = await res.json();
      if (data.success) {
        setNewMemory({ key: '', value: '', category: 'general' });
        await loadMemories();
      } else { alert(data.error || '保存失败'); }
    } catch { alert('保存失败，请重试'); }
    finally { setAddingMemory(false); }
  };

  const updateMemory = async (id: string) => {
    try {
      const res = await fetch('/api/admin/ai/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editMemoryForm),
      });
      const data = await res.json();
      if (data.success) {
        setEditingMemoryId(null);
        await loadMemories();
      } else { alert(data.error || '更新失败'); }
    } catch { alert('更新失败，请重试'); }
  };

  const deleteMemory = async (id: string) => {
    if (!confirm('确定删除这条记忆？')) return;
    try {
      const res = await fetch(`/api/admin/ai/memory?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) await loadMemories();
      else alert(data.error || '删除失败');
    } catch { alert('删除失败，请重试'); }
  };

  const MEMORY_CATEGORY_LABELS: Record<string, string> = {
    preference: '偏好',
    fact: '事实',
    instruction: '指令',
    context: '上下文',
    general: '通用',
  };

  // ─── Auth ────────────────────────────────────────────────────────

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
      if (data.success) { setAuthenticated(true); setPassword(''); }
      else { setAuthError(data.error || '密码错误'); }
    } catch { setAuthError('登录失败，请重试'); }
    finally { setAuthLoading(false); }
  };

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    setAuthenticated(false);
    setNews([]);
    setMessages([]);
    try { localStorage.removeItem(CHAT_STORAGE_KEY); } catch { /* ignore */ }
  };

  // ─── Admin Data Loading ──────────────────────────────────────────

  const loadNews = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/news');
      const data = await res.json();
      if (data.success) {
        const result = data.data;
        setNews(Array.isArray(result) ? result : result?.items || []);
      }
    } catch (err) { console.error('加载新闻失败:', err); }
    finally { setLoading(false); }
  };

  const loadPending = async () => {
    try {
      const res = await fetch('/api/admin/news/pending');
      const data = await res.json();
      setPendingNews(data.news || []);
      setPendingCount(data.count || 0);
    } catch { /* ignore */ }
  };

  // ─── Admin Actions ───────────────────────────────────────────────

  const deleteNews = async (id: string) => {
    if (!confirm('确定删除这条新闻？')) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/admin/news?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setNews(prev => prev.filter(n => n.id !== id));
        setPendingNews(prev => prev.filter(n => n.id !== id));
        setPendingCount(prev => Math.max(0, prev - 1));
      } else { alert(data.error || '删除失败'); }
    } catch { alert('删除失败，请重试'); }
    finally { setDeleting(null); }
  };

  const reviewSingle = async (id: string, action: 'approve' | 'reject', reason?: string) => {
    try {
      const res = await fetch('/api/admin/news/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newsId: id, action, reason }),
      });
      const data = await res.json();
      if (data.success) {
        setPendingNews(prev => prev.filter(n => n.id !== id));
        setPendingCount(prev => Math.max(0, prev - 1));
        setNews(prev => prev.map(n => n.id === id ? { ...n, status: action === 'approve' ? 'published' : 'rejected' } : n));
      } else { alert(data.error || '审核失败'); }
    } catch { alert('审核失败，请重试'); }
  };

  const batchReview = async (action: 'approve' | 'reject') => {
    if (selectedIds.size === 0) return;
    const reason = action === 'reject' ? rejectReasonInput : undefined;
    setReviewing(true);
    try {
      const res = await fetch('/api/admin/news/batch-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newsIds: Array.from(selectedIds), action, reason }),
      });
      const data = await res.json();
      if (data.success) {
        setPendingNews(prev => prev.filter(n => !selectedIds.has(n.id)));
        setPendingCount(prev => Math.max(0, prev - selectedIds.size));
        setSelectedIds(new Set());
        setRejectReasonInput('');
        await loadNews();
      } else { alert(data.error || '批量审核失败'); }
    } catch { alert('批量审核失败，请重试'); }
    finally { setReviewing(false); }
  };

  const saveEdit = async () => {
    if (!editingItem) return;
    try {
      const res = await fetch(`/api/admin/news/${editingItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editForm.title,
          summary: editForm.summary,
          category: editForm.category,
          importance_score: editForm.importanceScore,
          importance_level: editForm.importanceScore >= 35 ? 'SSS' : editForm.importanceScore >= 25 ? 'SS' : editForm.importanceScore >= 15 ? 'S' : 'A',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setEditingItem(null);
        await loadNews();
        await loadPending();
      } else { alert(data.error || '编辑失败'); }
    } catch { alert('编辑失败，请重试'); }
  };

  const openEdit = (item: NewsItem) => {
    setEditingItem(item);
    setEditForm({
      title: item.title,
      summary: item.summary,
      category: item.category,
      importanceScore: item.importance_score || item.importanceScore || 0,
    });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === pendingNews.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingNews.map(n => n.id)));
    }
  };

  // ─── Generate Actions ────────────────────────────────────────────

  const triggerDailySync = async () => {
    setGenerating('daily-sync');
    setGenerateResult(null);
    setCollectLogs([]);
    setCollectStreaming(true);

    const controller = new AbortController();
    collectAbortRef.current = controller;

    try {
      addCollectLog('info', '正在连接每日同步服务...');
      const res = await fetch('/api/cron/daily-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stream: true }),
        signal: controller.signal,
      });

      if (!res.ok) {
        addCollectLog('error', `连接失败: HTTP ${res.status}`);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        addCollectLog('error', '无法读取响应流');
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          const jsonStr = trimmed.slice(6).trim();
          if (!jsonStr || jsonStr === '[DONE]') continue;

          try {
            const event = JSON.parse(jsonStr);
            if (event.type === 'progress' || event.type === 'step') {
              addCollectLog('step', event.message || JSON.stringify(event));
            } else if (event.type === 'info') {
              addCollectLog('info', event.message || '');
            } else if (event.type === 'success') {
              addCollectLog('success', event.message || '同步完成');
              if (event.newsCount !== undefined) {
                addCollectLog('stats', `共收集 ${event.newsCount} 条新闻`);
              }
            } else if (event.type === 'error') {
              addCollectLog('error', event.message || '发生错误');
            } else if (event.type === 'done') {
              if (event.newsCount !== undefined) {
                addCollectLog('stats', `最终结果: ${event.newsCount} 条新闻入库`);
              }
              setGenerateResult({
                success: true,
                message: event.message || '每日同步完成',
                newsCount: event.newsCount,
              });
            }
          } catch {
            // Not JSON, treat as plain text log
            if (jsonStr.trim()) addCollectLog('info', jsonStr.trim());
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        addCollectLog('info', '已取消同步');
      } else {
        addCollectLog('error', `连接错误: ${err instanceof Error ? err.message : '未知错误'}`);
      }
    } finally {
      setCollectStreaming(false);
      setGenerating(null);
      collectAbortRef.current = null;
      await loadNews();
      await loadPending();
    }
  };

  const triggerRssCollect = async () => {
    setCollectLogs([]);
    setCollectStreaming(true);
    setGenerateResult(null);

    const controller = new AbortController();
    collectAbortRef.current = controller;

    try {
      addCollectLog('info', '正在采集橘鸦AI早报RSS...');
      const res = await fetch('/api/rss/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stream: true }),
        signal: controller.signal,
      });

      if (!res.ok) {
        addCollectLog('error', `连接失败: HTTP ${res.status}`);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        addCollectLog('error', '无法读取响应流');
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          const jsonStr = trimmed.slice(6).trim();
          if (!jsonStr || jsonStr === '[DONE]') continue;

          try {
            const event = JSON.parse(jsonStr);
            if (event.type === 'progress' || event.type === 'step') {
              addCollectLog('step', event.message || JSON.stringify(event));
            } else if (event.type === 'info') {
              addCollectLog('info', event.message || '');
            } else if (event.type === 'success') {
              addCollectLog('success', event.message || '采集完成');
              if (event.newsCount !== undefined) {
                addCollectLog('stats', `共收集 ${event.newsCount} 条新闻`);
              }
            } else if (event.type === 'error') {
              addCollectLog('error', event.message || '发生错误');
            } else if (event.type === 'done') {
              if (event.newsCount !== undefined) {
                addCollectLog('stats', `最终结果: ${event.newsCount} 条新闻入库`);
              }
              setGenerateResult({
                success: true,
                message: event.message || 'RSS采集完成',
                newsCount: event.newsCount,
              });
            }
          } catch {
            // Not JSON, treat as plain text log
            if (jsonStr.trim()) addCollectLog('info', jsonStr.trim());
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        addCollectLog('info', '已取消采集');
      } else {
        addCollectLog('error', `连接错误: ${err instanceof Error ? err.message : '未知错误'}`);
      }
    } finally {
      setCollectStreaming(false);
      collectAbortRef.current = null;
      await loadNews();
      await loadPending();
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
      await loadNews();
      await loadPending();
    } catch { setGenerateResult({ success: false, error: '请求失败，请重试' }); }
    finally { setGenerating(null); }
  };

  // ─── Streaming Collect ─────────────────────────────────────────

  const addCollectLog = (type: CollectLog['type'], message: string) => {
    const ts = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    setCollectLogs(prev => [...prev, { type, message, timestamp: ts }]);
  };

  const triggerCollectStream = async () => {
    if (collectStreaming) return;
    setCollectLogs([]);
    setCollectStreaming(true);
    setGenerateResult(null);

    const controller = new AbortController();
    collectAbortRef.current = controller;

    try {
      addCollectLog('info', '正在连接收集服务...');
      const res = await fetch('/api/news/collect?stream=1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      });

      if (!res.ok) {
        addCollectLog('error', `连接失败: HTTP ${res.status}`);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        addCollectLog('error', '无法读取响应流');
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          const jsonStr = trimmed.slice(6).trim();
          if (!jsonStr || jsonStr === '[DONE]') continue;

          try {
            const event = JSON.parse(jsonStr);
            if (event.type === 'progress' || event.type === 'step') {
              addCollectLog('step', event.message || JSON.stringify(event));
            } else if (event.type === 'info') {
              addCollectLog('info', event.message || '');
            } else if (event.type === 'success') {
              addCollectLog('success', event.message || '收集完成');
              if (event.newsCount !== undefined) {
                addCollectLog('stats', `共收集 ${event.newsCount} 条新闻`);
              }
            } else if (event.type === 'error') {
              addCollectLog('error', event.message || '发生错误');
            } else if (event.type === 'done') {
              if (event.newsCount !== undefined) {
                addCollectLog('stats', `最终结果: ${event.newsCount} 条新闻入库`);
              }
              setGenerateResult({
                success: true,
                message: event.message || '收集完成',
                newsCount: event.newsCount,
              });
            }
          } catch {
            // Not JSON, treat as plain text log
            if (jsonStr.trim()) addCollectLog('info', jsonStr.trim());
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        addCollectLog('info', '已取消收集');
      } else {
        addCollectLog('error', `连接错误: ${err instanceof Error ? err.message : '未知错误'}`);
      }
    } finally {
      setCollectStreaming(false);
      collectAbortRef.current = null;
      await loadNews();
      await loadPending();
    }
  };

  const cancelCollect = () => {
    collectAbortRef.current?.abort();
  };

  // ─── Chat Actions (quick actions that show in chat) ──────────────

  function getActionLabel(type: string) {
    const map: Record<string, string> = {
      collect: '收集资讯',
      daily: '生成日报',
      weekly: '生成周报',
      leaderboard: '更新排行榜',
      'daily-sync': '每日同步',
      'rss-collect': '采集RSS',
    };
    return map[type] ?? type;
  }

  const triggerChatAction = async (type: string) => {
    const actionLabel = getActionLabel(type);
    const userMsg: ChatMessage = { role: 'user', content: actionLabel };
    setMessages(prev => [...prev, userMsg]);

    try {
      let url = '';
      let body: Record<string, unknown> | undefined;
      if (type === 'daily-sync') {
        url = '/api/cron/daily-sync';
      } else if (type === 'rss-collect') {
        url = '/api/rss/collect';
      } else if (type === 'collect') {
        url = '/api/news/collect';
      } else if (type === 'daily') {
        url = '/api/daily/generate';
      } else if (type === 'weekly') {
        url = '/api/weekly/generate';
      } else {
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

      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: '',
          actionResult: {
            success,
            message: success
              ? `「${actionLabel}」执行成功${data.newsCount ? `，共 ${data.newsCount} 条` : ''}`
              : `「${actionLabel}」执行失败: ${data.error || '未知错误'}`,
          },
        },
      ]);

      await loadNews();
      await loadPending();
    } catch {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: '',
          actionResult: { success: false, message: `「${actionLabel}」请求失败` },
        },
      ]);
    }
  };

  // ─── Chat ────────────────────────────────────────────────────────

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || chatLoading) return;

    const userMsg: ChatMessage = { role: 'user', content: text };
    const assistantMsg: ChatMessage = { role: 'assistant', content: '', isLoading: true };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setInput('');
    setChatLoading(true);

    try {
      const history = [...messages, userMsg].map(m => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch('/api/admin/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

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

            if (event.type === 'content' && event.text) {
              assistantContent += event.text;
              setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last && last.role === 'assistant') {
                  last.content = assistantContent;
                  last.isLoading = false;
                }
                return updated;
              });
            } else if (event.type === 'action_start') {
              setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last && last.role === 'assistant') {
                  last.isLoading = true;
                }
                return updated;
              });
            } else if (event.type === 'action_result') {
              actionResult = {
                success: event.result?.success ?? false,
                message: event.result?.message ?? '',
              };
            } else if (event.type === 'done') {
              // Finalize
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }

      setMessages(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last && last.role === 'assistant') {
          last.content = assistantContent || '(无回复)';
          last.isLoading = false;
          if (actionResult) last.actionResult = actionResult;
        }
        return updated;
      });

      if (actionResult) {
        await loadNews();
        await loadPending();
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : '请求失败';
      setMessages(prev => {
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

  // ─── Helpers ─────────────────────────────────────────────────────

  const getScore = (n: NewsItem) => n.importance_score ?? n.importanceScore ?? 0;
  const getLevel = (n: NewsItem) => n.importance_level ?? n.importanceLevel ?? 'A';
  const getSource = (n: NewsItem) => n.source_name ?? n.source ?? '未知';

  const filteredNews = news.filter(n => {
    if (filterCategory !== 'all' && n.category !== filterCategory) return false;
    if (filterLevel !== 'all' && getLevel(n) !== filterLevel) return false;
    if (activeTab !== 'all' && (n.status || 'published') !== activeTab) return false;
    return true;
  });

  // ─── Login Page ──────────────────────────────────────────────────

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="max-w-md mx-auto px-4 py-24">
          <div className="bg-card rounded-lg border border-border p-8">
            <div className="flex items-center gap-3 mb-2">
              <Bot className="w-6 h-6 text-primary" />
              <h1 className="text-2xl font-bold text-foreground">管理后台</h1>
            </div>
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

  // ─── Admin Content (left columns) ────────────────────────────────

  const adminContent = (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">管理后台</h1>
          <p className="text-muted-foreground text-sm mt-1">管理新闻数据、审核资讯、手动触发内容生成</p>
        </div>
        <button onClick={handleLogout} className="px-4 py-2 text-sm border border-border rounded-md text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors">退出登录</button>
      </div>

      {/* Generate actions */}
      <div className="bg-card rounded-lg border border-border p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">手动触发生成</h2>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => triggerDailySync()} disabled={generating !== null || collectStreaming} className="px-5 py-2.5 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {generating === 'daily-sync' ? '同步中...' : '每日同步（RSS+日报）'}
          </button>
          <button onClick={() => triggerRssCollect()} disabled={generating !== null || collectStreaming} className="px-5 py-2.5 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {collectStreaming ? '采集中...' : '仅采集RSS'}
          </button>
          <button onClick={() => triggerGenerate('daily')} disabled={generating !== null || collectStreaming} className="px-5 py-2.5 bg-muted text-foreground rounded-md font-medium hover:bg-muted/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {generating === 'daily' ? '生成中...' : '仅生成日报'}
          </button>
          <button onClick={() => triggerGenerate('leaderboard')} disabled={generating !== null || collectStreaming} className="px-5 py-2.5 bg-muted text-foreground rounded-md font-medium hover:bg-muted/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
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
        <p className="text-muted-foreground text-xs mt-3">提示: 「每日同步」自动采集橘鸦RSS并生成日报（推荐）；「仅采集RSS」只采集不生成日报；「仅生成日报」使用已有数据生成。</p>
      </div>

      {/* Collect Progress Console */}
      {(collectStreaming || collectLogs.length > 0) && (
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/50">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-foreground">收集进度</span>
              {collectStreaming && (
                <span className="flex items-center gap-1.5 text-xs text-primary">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  运行中
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {collectStreaming && (
                <button onClick={cancelCollect} className="px-3 py-1 text-xs border border-destructive/30 text-destructive rounded hover:bg-destructive/10 transition-colors">
                  取消
                </button>
              )}
              {!collectStreaming && collectLogs.length > 0 && (
                <button onClick={() => setCollectLogs([])} className="px-3 py-1 text-xs border border-border text-muted-foreground rounded hover:text-foreground transition-colors">
                  清除
                </button>
              )}
            </div>
          </div>
          <div className="p-4 max-h-64 overflow-y-auto font-mono text-xs leading-relaxed space-y-0.5">
            {collectLogs.map((log, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-muted-foreground/60 shrink-0 select-none">{log.timestamp}</span>
                <span className={`${
                  log.type === 'step' ? 'text-blue-600 dark:text-blue-400' :
                  log.type === 'success' ? 'text-green-600 dark:text-green-400' :
                  log.type === 'error' ? 'text-red-600 dark:text-red-400' :
                  log.type === 'stats' ? 'text-amber-600 dark:text-amber-400 font-semibold' :
                  'text-muted-foreground'
                }`}>
                  {log.type === 'error' ? '✕ ' : log.type === 'success' ? '✓ ' : log.type === 'stats' ? '▶ ' : log.type === 'step' ? '▸ ' : '  '}{log.message}
                </span>
              </div>
            ))}
            {collectStreaming && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="w-1.5 h-4 bg-primary animate-pulse rounded-sm" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-card rounded-lg border border-border p-6">
        <div className="flex items-center gap-4 mb-4 border-b border-border pb-3">
          {(['all', 'pending', 'published', 'rejected'] as TabType[]).map(tab => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setSelectedIds(new Set()); }}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${activeTab === tab ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
            >
              {tab === 'all' ? '全部' : STATUS_LABELS[tab] || tab}
              {tab === 'pending' && pendingCount > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 text-xs bg-red-500 text-white rounded-full">{pendingCount}</span>
              )}
            </button>
          ))}
        </div>

        {/* Pending batch actions */}
        {activeTab === 'pending' && pendingNews.length > 0 && (
          <div className="flex items-center gap-3 mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={selectedIds.size === pendingNews.length && pendingNews.length > 0} onChange={toggleSelectAll} className="rounded" />
              全选 ({selectedIds.size}/{pendingNews.length})
            </label>
            <button
              onClick={() => batchReview('approve')}
              disabled={selectedIds.size === 0 || reviewing}
              className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              批量通过
            </button>
            <button
              onClick={() => batchReview('reject')}
              disabled={selectedIds.size === 0 || reviewing}
              className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              批量拒绝
            </button>
            <input
              type="text"
              value={rejectReasonInput}
              onChange={e => setRejectReasonInput(e.target.value)}
              placeholder="拒稿理由（可选）"
              className="flex-1 px-3 py-1.5 text-sm border border-border rounded bg-white"
            />
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-3 mb-4">
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="px-3 py-1.5 text-sm border border-border rounded-md bg-muted text-foreground">
            <option value="all">全部分类</option>
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <select value={filterLevel} onChange={e => setFilterLevel(e.target.value)} className="px-3 py-1.5 text-sm border border-border rounded-md bg-muted text-foreground">
            <option value="all">全部级别</option>
            <option value="SSS">SSS</option>
            <option value="SS">SS</option>
            <option value="S">S</option>
            <option value="A">A</option>
          </select>
          <button onClick={() => { loadNews(); loadPending(); }} disabled={loading} className="px-3 py-1.5 text-sm border border-border rounded-md text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50">
            {loading ? '加载中...' : '刷新'}
          </button>
        </div>

        {/* News list */}
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">加载中...</div>
        ) : filteredNews.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {activeTab === 'pending' ? '暂无待审核新闻 🎉' : '暂无新闻数据'}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredNews.map((item, idx) => {
              const itemStatus = item.status || 'published';
              const isSelected = selectedIds.has(item.id);
              return (
                <div key={item.id} className={`flex items-start gap-3 p-3 rounded-md border transition-colors ${isSelected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}>
                  {activeTab === 'pending' && (
                    <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(item.id)} className="mt-1 rounded" />
                  )}
                  <span className="text-muted-foreground text-sm font-mono w-6 text-right shrink-0 pt-0.5">{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2">
                      <h3 className="text-foreground text-sm font-medium leading-snug line-clamp-2">{item.title}</h3>
                    </div>
                    {item.summary && (
                      <p className="text-muted-foreground text-xs mt-1 line-clamp-2">{item.summary}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${LEVEL_COLORS[getLevel(item)] || 'bg-muted text-muted-foreground'}`}>
                        {getLevel(item)}
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${STATUS_COLORS[itemStatus] || 'bg-muted text-muted-foreground'}`}>
                        {STATUS_LABELS[itemStatus] || itemStatus}
                      </span>
                      <span className="text-xs text-muted-foreground">{CATEGORY_LABELS[item.category] || item.category}</span>
                      <span className="text-xs text-muted-foreground">来源: {getSource(item)}</span>
                      <span className="text-xs text-muted-foreground">分数: {getScore(item)}</span>
                      {item.reject_reason && (
                        <span className="text-xs text-red-600">拒稿: {item.reject_reason}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {itemStatus === 'pending' && (
                      <>
                        <button onClick={() => reviewSingle(item.id, 'approve')} className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors">通过</button>
                        <button onClick={() => reviewSingle(item.id, 'reject')} className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors">拒绝</button>
                      </>
                    )}
                    <button onClick={() => openEdit(item)} className="px-2 py-1 text-xs border border-border text-muted-foreground rounded hover:text-foreground hover:border-foreground/30 transition-colors">编辑</button>
                    <button onClick={() => deleteNews(item.id)} disabled={deleting === item.id} className="px-2 py-1 text-xs border border-destructive/30 text-destructive rounded hover:bg-destructive/10 transition-colors disabled:opacity-50">
                      {deleting === item.id ? '...' : '删除'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  // ─── Chat Panel (right column) ───────────────────────────────────

  const chatPanel = (
    <div className="flex flex-col bg-card rounded-lg border border-border overflow-hidden" style={{ height: 'calc(100vh - 140px)' }}>
      {/* Chat Header */}
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-border shrink-0">
        <Bot className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">AI 助手</h2>
        <span className="text-xs text-muted-foreground ml-2">可以问我任何问题，或让我执行操作</span>
        {messages.length > 0 && (
          <button
            onClick={clearChatHistory}
            className="ml-auto px-2.5 py-1 text-xs border border-border text-muted-foreground rounded hover:text-foreground hover:border-foreground/30 transition-colors"
          >
            清空
          </button>
        )}
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Bot className="w-12 h-12 mb-4 opacity-30" />
            <p className="text-sm">你好！我是 AI Pulse 管理助手</p>
            <p className="text-xs mt-1">你可以让我查看数据、收集资讯、生成日报等</p>
            <div className="flex flex-wrap gap-2 mt-4">
              {['查看系统状态', '最近有什么新闻？', '今天待审核的新闻有多少？'].map(q => (
                <button
                  key={q}
                  onClick={() => setInput(q)}
                  className="px-3 py-1.5 text-xs bg-muted text-muted-foreground rounded-md hover:text-foreground hover:bg-muted/80 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
            {/* Quick action buttons */}
            <div className="flex flex-wrap gap-2 mt-3">
              {[
                { type: 'daily-sync', label: '每日同步', icon: Newspaper },
                { type: 'rss-collect', label: '采集RSS', icon: Calendar },
              ].map(({ type, label, icon: Icon }) => (
                <button
                  key={type}
                  onClick={() => triggerChatAction(type)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary/10 text-primary rounded-md hover:bg-primary/20 transition-colors"
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className="max-w-[80%]">
              {msg.role === 'user' ? (
                <div className="bg-primary text-primary-foreground px-4 py-2.5 rounded-lg rounded-br-sm text-sm leading-relaxed whitespace-pre-wrap">
                  {msg.content}
                </div>
              ) : (
                <div className="space-y-2">
                  {msg.actionResult && (
                    <div className={`flex items-start gap-2 px-4 py-3 rounded-lg border text-sm ${msg.actionResult.success ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                      {msg.actionResult.success ? (
                        <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      )}
                      <span>{msg.actionResult.message}</span>
                    </div>
                  )}
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
            onChange={e => setInput(e.target.value)}
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
  );

  // ─── Main Layout ─────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Mobile Tab Switcher */}
        <div className="flex lg:hidden gap-2 mb-4">
          <button
            onClick={() => setMobileTab('admin')}
            className={`flex-1 py-2.5 text-sm rounded-md font-medium transition-colors ${mobileTab === 'admin' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
          >
            管理
          </button>
          <button
            onClick={() => setMobileTab('chat')}
            className={`flex-1 py-2.5 text-sm rounded-md font-medium transition-colors ${mobileTab === 'chat' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
          >
            <span className="flex items-center justify-center gap-1.5">
              <Bot className="w-4 h-4" />
              AI 助手
            </span>
          </button>
        </div>

        {/* Desktop: 3-column grid. Mobile: show selected tab */}
        <div className="hidden lg:grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">{adminContent}</div>
          <div>{chatPanel}</div>
        </div>
        <div className="lg:hidden">
          {mobileTab === 'admin' ? adminContent : chatPanel}
        </div>
      </div>

      {/* Edit modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setEditingItem(null)}>
          <div className="bg-card rounded-lg border border-border p-6 max-w-lg w-full" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-foreground mb-4">编辑新闻</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">标题</label>
                <input type="text" value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} className="w-full px-3 py-2 text-sm border border-border rounded-md bg-muted text-foreground" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">摘要</label>
                <textarea value={editForm.summary} onChange={e => setEditForm(f => ({ ...f, summary: e.target.value }))} rows={4} className="w-full px-3 py-2 text-sm border border-border rounded-md bg-muted text-foreground resize-none" />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-sm text-muted-foreground mb-1 block">分类</label>
                  <select value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))} className="w-full px-3 py-2 text-sm border border-border rounded-md bg-muted text-foreground">
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-sm text-muted-foreground mb-1 block">分数</label>
                  <input type="number" value={editForm.importanceScore} onChange={e => setEditForm(f => ({ ...f, importanceScore: Number(e.target.value) }))} className="w-full px-3 py-2 text-sm border border-border rounded-md bg-muted text-foreground" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setEditingItem(null)} className="px-4 py-2 text-sm border border-border rounded-md text-muted-foreground hover:text-foreground">取消</button>
              <button onClick={saveEdit} className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90">保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
