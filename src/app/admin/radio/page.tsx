'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Trash2,
  Edit3,
  Check,
  X,
  Radio,
  Calendar,
  Clock,
  ArrowLeft,
  Loader2,
  Play,
  Pause,
} from 'lucide-react';

interface RadioBroadcast {
  id: string;
  title: string;
  description: string | null;
  audio_url: string;
  duration: number | null;
  date: string;
  category: string;
  created_at: string;
  updated_at: string;
}

const CATEGORIES = ['daily', 'weekly', 'special'];

export default function AdminRadioPage() {
  const router = useRouter();

  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const [broadcasts, setBroadcasts] = useState<RadioBroadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  // 预览播放状态
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // 表单状态
  const [form, setForm] = useState({
    title: '',
    description: '',
    audio_url: '',
    duration: 0,
    date: new Date().toISOString().split('T')[0],
    category: 'daily',
  });

  // ─── Auth ────────────────────────────────────────────────────

  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/verify');
      if (res.ok) setAuthenticated(true);
    } catch { /* not authenticated */ }
  }, []);

  useEffect(() => {
    checkAuth();
    // 初始化预览音频
    if (typeof window !== 'undefined' && !previewAudioRef.current) {
      previewAudioRef.current = new Audio();
      previewAudioRef.current.addEventListener('ended', () => setIsPreviewPlaying(false));
    }
  }, [checkAuth]);

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

  // ─── Data ────────────────────────────────────────────────────

  const loadBroadcasts = useCallback(async () => {
    if (!authenticated) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/radio');
      if (res.ok) {
        const data = await res.json();
        setBroadcasts(Array.isArray(data) ? data : []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [authenticated]);

  useEffect(() => { loadBroadcasts(); }, [loadBroadcasts]);

  // ─── Preview ─────────────────────────────────────────────────

  const togglePreview = (broadcast: RadioBroadcast) => {
    if (!previewAudioRef.current) return;

    if (previewing === broadcast.id) {
      if (isPreviewPlaying) {
        previewAudioRef.current.pause();
      } else {
        previewAudioRef.current.play().catch(() => {});
      }
    } else {
      previewAudioRef.current.pause();
      previewAudioRef.current.src = broadcast.audio_url;
      previewAudioRef.current.play().catch(() => {});
      setPreviewing(broadcast.id);
    }
  };

  // ─── CRUD ────────────────────────────────────────────────────

  const resetForm = () => {
    setForm({
      title: '',
      description: '',
      audio_url: '',
      duration: 0,
      date: new Date().toISOString().split('T')[0],
      category: 'daily',
    });
  };

  const handleAdd = async () => {
    if (!form.title || !form.audio_url || !form.date) return;
    try {
      const res = await fetch('/api/admin/radio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setShowAdd(false);
        resetForm();
        await loadBroadcasts();
      } else {
        const data = await res.json();
        alert(data.error || '添加失败');
      }
    } catch {
      alert('网络错误');
    }
  };

  const handleUpdate = async (id: string) => {
    try {
      const res = await fetch('/api/admin/radio', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...form }),
      });
      if (res.ok) {
        setEditing(null);
        resetForm();
        await loadBroadcasts();
      } else {
        const data = await res.json();
        alert(data.error || '更新失败');
      }
    } catch {
      alert('网络错误');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个播客吗？')) return;
    try {
      const res = await fetch('/api/admin/radio', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        await loadBroadcasts();
      } else {
        const data = await res.json();
        alert(data.error || '删除失败');
      }
    } catch {
      alert('网络错误');
    }
  };

  const startEdit = (broadcast: RadioBroadcast) => {
    setEditing(broadcast.id);
    setForm({
      title: broadcast.title,
      description: broadcast.description || '',
      audio_url: broadcast.audio_url,
      duration: broadcast.duration || 0,
      date: broadcast.date,
      category: broadcast.category,
    });
    setShowAdd(false);
  };

  const startAdd = () => {
    setShowAdd(true);
    resetForm();
    setEditing(null);
  };

  // ─── Format ──────────────────────────────────────────────────

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // ─── Login ──────────────────────────────────────────────────

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-background font-sans">
        <div className="max-w-sm mx-auto px-4 py-20">
          <div className="bg-card rounded-xl border border-border p-8">
            <div className="text-center mb-6">
              <Radio className="w-10 h-10 text-primary mx-auto mb-3" />
              <h1 className="text-xl font-bold text-foreground">AI Pulse 电台管理</h1>
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
              {authError && <p className="text-xs text-red-500 text-center">{authError}</p>}
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

  // ─── Main ──────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background font-sans">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/admin/workspace')}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold font-display text-foreground">电台管理</h1>
              <p className="text-sm text-muted-foreground mt-0.5">管理 AI 电台播客节目</p>
            </div>
          </div>
          <button
            onClick={startAdd}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            添加节目
          </button>
        </div>

        {/* 添加表单 */}
        {showAdd && (
          <div className="bg-card rounded-xl border border-border p-6 mb-6">
            <h3 className="text-sm font-semibold text-foreground mb-4">添加新节目</h3>
            <BroadcastForm
              form={form}
              setForm={setForm}
              onSubmit={handleAdd}
              onCancel={() => { setShowAdd(false); resetForm(); }}
              submitLabel="添加"
            />
          </div>
        )}

        {/* 播客列表 */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : broadcasts.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Radio className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">暂无节目，点击右上角添加</p>
          </div>
        ) : (
          <div className="space-y-3">
            {broadcasts.map(broadcast => (
              <div
                key={broadcast.id}
                className="bg-card rounded-lg border border-border/50 p-5"
              >
                {editing === broadcast.id ? (
                  <div>
                    <BroadcastForm
                      form={form}
                      setForm={setForm}
                      onSubmit={() => handleUpdate(broadcast.id)}
                      onCancel={() => { setEditing(null); resetForm(); }}
                      submitLabel="保存"
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    {/* 预览按钮 */}
                    <button
                      onClick={() => togglePreview(broadcast)}
                      className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                        previewing === broadcast.id && isPreviewPlaying
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {previewing === broadcast.id && isPreviewPlaying ? (
                        <Pause className="w-4 h-4" />
                      ) : (
                        <Play className="w-4 h-4 ml-0.5" />
                      )}
                    </button>

                    {/* 信息 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-foreground">{broadcast.title}</span>
                        <span className="px-2 py-0.5 text-[11px] font-medium rounded bg-muted text-muted-foreground">
                          {broadcast.category}
                        </span>
                      </div>
                      {broadcast.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {broadcast.description}
                        </p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground/60 mt-1.5">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(broadcast.date)}
                        </span>
                        {broadcast.duration != null && broadcast.duration > 0 && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDuration(broadcast.duration)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 操作 */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => startEdit(broadcast)}
                        className="p-2 text-muted-foreground hover:text-primary transition-colors"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(broadcast.id)}
                        className="p-2 text-muted-foreground hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 统计 */}
        <div className="mt-8 pt-6 border-t border-border/30">
          <div className="text-xs text-muted-foreground">
            共 {broadcasts.length} 期节目
          </div>
        </div>
      </main>
    </div>
  );
}

// ─── 表单组件 ─────────────────────────────────────────────────

function BroadcastForm({
  form,
  setForm,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  form: typeof form_default;
  setForm: React.Dispatch<React.SetStateAction<typeof form_default>>;
  onSubmit: () => void;
  onCancel: () => void;
  submitLabel: string;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <label className="block text-xs text-muted-foreground mb-1">标题 *</label>
        <input
          value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-muted text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          placeholder="如：AI早报 2024年1月1日"
        />
      </div>
      <div>
        <label className="block text-xs text-muted-foreground mb-1">日期 *</label>
        <input
          type="date"
          value={form.date}
          onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
          className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-muted text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>
      <div className="sm:col-span-2">
        <label className="block text-xs text-muted-foreground mb-1">音频URL *</label>
        <input
          value={form.audio_url}
          onChange={e => setForm(f => ({ ...f, audio_url: e.target.value }))}
          className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-muted text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          placeholder="https://...mp3"
        />
      </div>
      <div className="sm:col-span-2">
        <label className="block text-xs text-muted-foreground mb-1">描述</label>
        <input
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-muted text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          placeholder="简要描述本期内容"
        />
      </div>
      <div>
        <label className="block text-xs text-muted-foreground mb-1">时长（秒）</label>
        <input
          type="number"
          value={form.duration}
          onChange={e => setForm(f => ({ ...f, duration: parseInt(e.target.value) || 0 }))}
          className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-muted text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          placeholder="180"
        />
      </div>
      <div>
        <label className="block text-xs text-muted-foreground mb-1">分类</label>
        <select
          value={form.category}
          onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
          className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-muted text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          {CATEGORIES.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2 flex items-center gap-3 pt-2">
        <button
          onClick={onSubmit}
          disabled={!form.title || !form.audio_url || !form.date}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          <Check className="w-4 h-4" />
          {submitLabel}
        </button>
        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-4 h-4" />
          取消
        </button>
      </div>
    </div>
  );
}

const form_default = {
  title: '',
  description: '',
  audio_url: '',
  duration: 0,
  date: new Date().toISOString().split('T')[0],
  category: 'daily',
};
