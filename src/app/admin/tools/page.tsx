'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Trash2,
  Edit3,
  Check,
  X,
  Loader2,
  Wrench,
  ExternalLink,
  Star,
  ArrowLeft,
} from 'lucide-react';

interface AITool {
  id: string;
  name: string;
  description: string;
  url: string;
  icon_url: string | null;
  category: string;
  is_featured: boolean;
  sort_order: number;
  created_at: string;
}

const CATEGORIES = ['IDE', '平台', 'Agent', '设计', '框架', '其他'];

const categoryColors: Record<string, string> = {
  'IDE': 'bg-blue-500/10 text-blue-600',
  '平台': 'bg-purple-500/10 text-purple-600',
  'Agent': 'bg-emerald-500/10 text-emerald-600',
  '设计': 'bg-pink-500/10 text-pink-600',
  '框架': 'bg-amber-500/10 text-amber-600',
  '其他': 'bg-gray-500/10 text-gray-600',
};

export default function AdminToolsPage() {
  const router = useRouter();

  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const [tools, setTools] = useState<AITool[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  // 表单状态
  const [form, setForm] = useState({
    name: '',
    description: '',
    url: '',
    icon_url: '',
    category: '其他',
    is_featured: false,
    sort_order: 0,
  });

  // ─── Auth ────────────────────────────────────────────────────

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

  // ─── Data ────────────────────────────────────────────────────

  const loadTools = useCallback(async () => {
    if (!authenticated) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/tools');
      if (res.ok) {
        const data = await res.json();
        setTools(Array.isArray(data) ? data : []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [authenticated]);

  useEffect(() => { loadTools(); }, [loadTools]);

  // ─── CRUD ────────────────────────────────────────────────────

  const resetForm = () => {
    setForm({ name: '', description: '', url: '', icon_url: '', category: '其他', is_featured: false, sort_order: 0 });
  };

  const handleAdd = async () => {
    if (!form.name || !form.url) return;
    try {
      const res = await fetch('/api/admin/tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setShowAdd(false);
        resetForm();
        await loadTools();
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
      const res = await fetch('/api/admin/tools', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...form }),
      });
      if (res.ok) {
        setEditing(null);
        resetForm();
        await loadTools();
      } else {
        const data = await res.json();
        alert(data.error || '更新失败');
      }
    } catch {
      alert('网络错误');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个工具吗？')) return;
    try {
      const res = await fetch('/api/admin/tools', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        await loadTools();
      } else {
        const data = await res.json();
        alert(data.error || '删除失败');
      }
    } catch {
      alert('网络错误');
    }
  };

  const startEdit = (tool: AITool) => {
    setEditing(tool.id);
    setForm({
      name: tool.name,
      description: tool.description || '',
      url: tool.url,
      icon_url: tool.icon_url || '',
      category: tool.category,
      is_featured: tool.is_featured,
      sort_order: tool.sort_order,
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
              <Wrench className="w-10 h-10 text-primary mx-auto mb-3" />
              <h1 className="text-xl font-bold text-foreground">AI Pulse 工具管理</h1>
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

  // ─── Main ────────────────────────────────────────────────────

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
              <h1 className="text-2xl font-bold font-display text-foreground">工具管理</h1>
              <p className="text-sm text-muted-foreground mt-0.5">管理 AI 工具推荐列表</p>
            </div>
          </div>
          <button
            onClick={startAdd}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            添加工具
          </button>
        </div>

        {/* 添加表单 */}
        {showAdd && (
          <div className="bg-card rounded-xl border border-border p-6 mb-6">
            <h3 className="text-sm font-semibold text-foreground mb-4">添加新工具</h3>
            <ToolForm
              form={form}
              setForm={setForm}
              onSubmit={handleAdd}
              onCancel={() => { setShowAdd(false); resetForm(); }}
              submitLabel="添加"
            />
          </div>
        )}

        {/* 工具列表 */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : tools.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Wrench className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">暂无工具，点击右上角添加</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tools.map(tool => (
              <div
                key={tool.id}
                className="bg-card rounded-lg border border-border/50 px-5 py-4"
              >
                {editing === tool.id ? (
                  <div>
                    <ToolForm
                      form={form}
                      setForm={setForm}
                      onSubmit={() => handleUpdate(tool.id)}
                      onCancel={() => { setEditing(null); resetForm(); }}
                      submitLabel="保存"
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    {/* 图标 */}
                    {tool.icon_url ? (
                      <img src={tool.icon_url} alt="" className="w-9 h-9 rounded-lg object-contain bg-muted/50 p-1" />
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-muted/50 flex items-center justify-center text-sm">🔧</div>
                    )}

                    {/* 信息 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">{tool.name}</span>
                        {tool.is_featured && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />}
                        <span className={`px-2 py-0.5 text-[11px] font-medium rounded ${categoryColors[tool.category] || categoryColors['其他']}`}>
                          {tool.category}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{tool.description || tool.url}</p>
                    </div>

                    {/* 链接 + 操作 */}
                    <a
                      href={tool.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    <button
                      onClick={() => startEdit(tool)}
                      className="text-muted-foreground hover:text-primary transition-colors"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(tool.id)}
                      className="text-muted-foreground hover:text-red-500 transition-colors"
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
            共 {tools.length} 个工具 · 精选 {tools.filter(t => t.is_featured).length} 个
          </div>
        </div>
      </main>
    </div>
  );
}

// ─── 表单组件 ─────────────────────────────────────────────────

function ToolForm({
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
        <label className="block text-xs text-muted-foreground mb-1">名称 *</label>
        <input
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-muted text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          placeholder="如：Cursor"
        />
      </div>
      <div>
        <label className="block text-xs text-muted-foreground mb-1">链接 *</label>
        <input
          value={form.url}
          onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
          className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-muted text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          placeholder="https://..."
        />
      </div>
      <div className="sm:col-span-2">
        <label className="block text-xs text-muted-foreground mb-1">描述</label>
        <input
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-muted text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          placeholder="简短描述工具的用途和特点"
        />
      </div>
      <div>
        <label className="block text-xs text-muted-foreground mb-1">图标URL</label>
        <input
          value={form.icon_url}
          onChange={e => setForm(f => ({ ...f, icon_url: e.target.value }))}
          className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-muted text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          placeholder="https://...（可选）"
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
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.is_featured}
            onChange={e => setForm(f => ({ ...f, is_featured: e.target.checked }))}
            className="rounded border-border"
          />
          <span className="text-xs text-muted-foreground">精选推荐</span>
        </label>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">排序</label>
          <input
            type="number"
            value={form.sort_order}
            onChange={e => setForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))}
            className="w-20 px-3 py-2 text-sm border border-border rounded-lg bg-muted text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>
      <div className="sm:col-span-2 flex items-center gap-3 pt-2">
        <button
          onClick={onSubmit}
          disabled={!form.name || !form.url}
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
  name: '',
  description: '',
  url: '',
  icon_url: '',
  category: '其他',
  is_featured: false,
  sort_order: 0,
};
