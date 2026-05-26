'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Trash2,
  Edit3,
  Check,
  X,
  Clock,
  ExternalLink,
  ArrowLeft,
  Loader2,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────

interface Milestone {
  id: string;
  date: string;
  title: string;
  description: string | null;
  category: 'breakthrough' | 'model' | 'product' | 'opensource' | 'event' | 'regulation';
  importance: number;
  link_url: string | null;
  created_at: string;
  updated_at: string;
}

const CATEGORIES = [
  { value: 'breakthrough', label: '技术突破' },
  { value: 'model', label: '模型' },
  { value: 'product', label: '产品' },
  { value: 'opensource', label: '开源' },
  { value: 'event', label: '行业事件' },
  { value: 'regulation', label: '政策监管' },
];

const CATEGORY_COLORS: Record<string, string> = {
  breakthrough: 'bg-violet-500/10 text-violet-600',
  model: 'bg-blue-500/10 text-blue-600',
  product: 'bg-emerald-500/10 text-emerald-600',
  opensource: 'bg-cyan-500/10 text-cyan-600',
  event: 'bg-amber-500/10 text-amber-600',
  regulation: 'bg-red-500/10 text-red-600',
};

// ─── Page Component ──────────────────────────────────────────────────

export default function AdminMilestonesPage() {
  const router = useRouter();

  // Auth state
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Data state
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  // Form state
  const [form, setForm] = useState({
    date: '',
    title: '',
    description: '',
    category: 'model' as Milestone['category'],
    importance: 3,
    link_url: '',
  });

  // ─── Auth ──────────────────────────────────────────────────────

  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/verify');
      if (res.ok) setAuthenticated(true);
    } catch { /* not authenticated */ }
  }, []);

  useEffect(() => { checkAuth(); }, [checkAuth]);

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

  // ─── Data ──────────────────────────────────────────────────────

  const loadMilestones = useCallback(async () => {
    if (!authenticated) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/milestones');
      if (res.ok) {
        const data = await res.json();
        setMilestones(Array.isArray(data) ? data : []);
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [authenticated]);

  useEffect(() => { loadMilestones(); }, [loadMilestones]);

  // ─── CRUD ─────────────────────────────────────────────────────

  const resetForm = () => {
    setForm({
      date: '',
      title: '',
      description: '',
      category: 'model',
      importance: 3,
      link_url: '',
    });
  };

  const handleAdd = async () => {
    if (!form.date || !form.title) return;
    try {
      const res = await fetch('/api/admin/milestones', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'admin-password': '210527',
        },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setShowAdd(false);
        resetForm();
        await loadMilestones();
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
      const res = await fetch('/api/admin/milestones', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'admin-password': '210527',
        },
        body: JSON.stringify({ id, ...form }),
      });
      if (res.ok) {
        setEditing(null);
        resetForm();
        await loadMilestones();
      } else {
        const data = await res.json();
        alert(data.error || '更新失败');
      }
    } catch {
      alert('网络错误');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个里程碑吗？')) return;
    try {
      const res = await fetch('/api/admin/milestones', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'admin-password': '210527',
        },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        await loadMilestones();
      } else {
        const data = await res.json();
        alert(data.error || '删除失败');
      }
    } catch {
      alert('网络错误');
    }
  };

  const startEdit = (m: Milestone) => {
    setEditing(m.id);
    setForm({
      date: m.date,
      title: m.title,
      description: m.description || '',
      category: m.category,
      importance: m.importance,
      link_url: m.link_url || '',
    });
    setShowAdd(false);
  };

  const startAdd = () => {
    setShowAdd(true);
    resetForm();
    setEditing(null);
  };

  // ─── Login ───────────────────────────────────────────────────

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-background font-sans">
        <div className="max-w-sm mx-auto px-4 py-20">
          <div className="bg-card rounded-xl border border-border p-8">
            <div className="text-center mb-6">
              <Clock className="w-10 h-10 text-primary mx-auto mb-3" />
              <h1 className="text-xl font-bold text-foreground">里程碑管理</h1>
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

  // ─── Main ───────────────────────────────────────────────────

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
              <h1 className="text-2xl font-bold font-display text-foreground">里程碑管理</h1>
              <p className="text-sm text-muted-foreground mt-0.5">管理 AI 发展时间线事件</p>
            </div>
          </div>
          <button
            onClick={startAdd}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            添加里程碑
          </button>
        </div>

        {/* 添加表单 */}
        {showAdd && (
          <div className="bg-card rounded-xl border border-border p-6 mb-6">
            <h3 className="text-sm font-semibold text-foreground mb-4">添加新里程碑</h3>
            <MilestoneForm
              form={form}
              setForm={setForm}
              onSubmit={handleAdd}
              onCancel={() => { setShowAdd(false); resetForm(); }}
              submitLabel="添加"
            />
          </div>
        )}

        {/* 列表 */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : milestones.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Clock className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">暂无里程碑，点击右上角添加</p>
          </div>
        ) : (
          <div className="space-y-3">
            {milestones.map(m => (
              <div
                key={m.id}
                className="bg-card rounded-lg border border-border/50 px-5 py-4"
              >
                {editing === m.id ? (
                  <div>
                    <MilestoneForm
                      form={form}
                      setForm={setForm}
                      onSubmit={() => handleUpdate(m.id)}
                      onCancel={() => { setEditing(null); resetForm(); }}
                      submitLabel="保存"
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    {/* 日期 */}
                    <div className="text-sm font-mono font-semibold text-muted-foreground shrink-0 w-28">
                      {m.date}
                    </div>

                    {/* 信息 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-foreground">{m.title}</span>
                        <span className={`px-2 py-0.5 text-[10px] font-medium rounded ${CATEGORY_COLORS[m.category] || ''}`}>
                          {CATEGORIES.find(c => c.value === m.category)?.label || m.category}
                        </span>
                        {m.importance >= 4 && (
                          <span className="px-2 py-0.5 text-[10px] font-medium rounded bg-amber-100 text-amber-700">
                            {m.importance === 5 ? '里程碑' : '重要'}
                          </span>
                        )}
                      </div>
                      {m.description && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{m.description}</p>
                      )}
                    </div>

                    {/* 链接 + 操作 */}
                    {m.link_url && (
                      <a
                        href={m.link_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                    <button
                      onClick={() => startEdit(m)}
                      className="text-muted-foreground hover:text-primary transition-colors shrink-0"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(m.id)}
                      className="text-muted-foreground hover:text-red-500 transition-colors shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 统计 */}
        <div className="mt-8 pt-6 border-t border-border/30">
          <div className="text-xs text-muted-foreground">
            共 {milestones.length} 个里程碑 · 里程碑级 {milestones.filter(m => m.importance === 5).length} 个
          </div>
        </div>
      </main>
    </div>
  );
}

// ─── Form Component ─────────────────────────────────────────────────

function MilestoneForm({
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
        <label className="block text-xs text-muted-foreground mb-1">日期 *</label>
        <input
          type="date"
          value={form.date}
          onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
          className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-muted text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>
      <div>
        <label className="block text-xs text-muted-foreground mb-1">标题 *</label>
        <input
          value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-muted text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          placeholder="如：GPT-4 发布"
        />
      </div>
      <div className="sm:col-span-2">
        <label className="block text-xs text-muted-foreground mb-1">描述</label>
        <textarea
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          rows={2}
          className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-muted text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
          placeholder="简短描述该里程碑的意义"
        />
      </div>
      <div>
        <label className="block text-xs text-muted-foreground mb-1">分类</label>
        <select
          value={form.category}
          onChange={e => setForm(f => ({ ...f, category: e.target.value as Milestone['category'] }))}
          className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-muted text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          {CATEGORIES.map(cat => (
            <option key={cat.value} value={cat.value}>{cat.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs text-muted-foreground mb-1">重要度 (1-5)</label>
        <select
          value={form.importance}
          onChange={e => setForm(f => ({ ...f, importance: parseInt(e.target.value) }))}
          className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-muted text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          {[1, 2, 3, 4, 5].map(n => (
            <option key={n} value={n}>{n} - {n === 5 ? '里程碑' : n === 4 ? '重要' : n === 3 ? '一般' : n === 2 ? '次要' : '小事'}</option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className="block text-xs text-muted-foreground mb-1">关联链接</label>
        <input
          value={form.link_url}
          onChange={e => setForm(f => ({ ...f, link_url: e.target.value }))}
          className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-muted text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          placeholder="https://...（可选）"
        />
      </div>
      <div className="sm:col-span-2 flex items-center gap-3 pt-2">
        <button
          onClick={onSubmit}
          disabled={!form.date || !form.title}
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
  date: '',
  title: '',
  description: '',
  category: 'model' as Milestone['category'],
  importance: 3,
  link_url: '',
};
