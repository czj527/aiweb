'use client';

import { useState, useEffect } from 'react';
import { ExternalLink, Star, Wrench } from 'lucide-react';

interface AITool {
  id: string;
  name: string;
  description: string;
  url: string;
  icon_url: string | null;
  category: string;
  is_featured: boolean;
  sort_order: number;
}

// 分类配色
const categoryColors: Record<string, string> = {
  'IDE': 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  '平台': 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  'Agent': 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  '设计': 'bg-pink-500/10 text-pink-600 border-pink-500/20',
  '框架': 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  '其他': 'bg-gray-500/10 text-gray-600 border-gray-500/20',
};

// 分类图标emoji
const categoryEmoji: Record<string, string> = {
  'IDE': '💻',
  '平台': '🏗️',
  'Agent': '🤖',
  '设计': '🎨',
  '框架': '📦',
  '其他': '🔧',
};

export function ToolsClient({ initialTools }: { initialTools: AITool[] }) {
  const [tools, setTools] = useState<AITool[]>(initialTools);
  const [selectedCategory, setSelectedCategory] = useState<string>('全部');
  const [needsFetch, setNeedsFetch] = useState(initialTools.length === 0);

  // 客户端兜底
  useEffect(() => {
    if (!needsFetch) return;
    fetch('/api/tools')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setTools(data);
          setNeedsFetch(false);
        }
      })
      .catch(() => {});
  }, [needsFetch]);

  // 提取分类列表
  const categories = ['全部', ...Array.from(new Set(tools.map(t => t.category)))];

  // 筛选
  const filtered = selectedCategory === '全部'
    ? tools
    : tools.filter(t => t.category === selectedCategory);

  // 精选与普通
  const featured = filtered.filter(t => t.is_featured);
  const regular = filtered.filter(t => !t.is_featured);

  return (
    <div className="min-h-screen bg-background font-sans">
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <Wrench className="w-6 h-6 text-primary" />
            <h1 className="text-2xl sm:text-3xl font-bold font-display text-foreground">AI 工具推荐</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            精选 AI 开发工具与项目，助力效率提升
          </p>
        </div>

        {/* 分类筛选 */}
        <div className="flex flex-wrap gap-2 mb-8">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                selectedCategory === cat
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-muted-foreground border-border/50 hover:border-primary/40 hover:text-foreground'
              }`}
            >
              {cat !== '全部' && <span className="mr-1">{categoryEmoji[cat] || '🔧'}</span>}
              {cat}
            </button>
          ))}
        </div>

        {/* 精选推荐 */}
        {featured.length > 0 && (
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <Star className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">精选推荐</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {featured.map(tool => (
                <ToolCard key={tool.id} tool={tool} featured />
              ))}
            </div>
          </div>
        )}

        {/* 全部工具 */}
        <div>
          {featured.length > 0 && (
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">全部工具</h2>
          )}
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Wrench className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">暂无工具推荐</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {(featured.length > 0 ? regular : filtered).map(tool => (
                <ToolCard key={tool.id} tool={tool} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function ToolCard({ tool, featured }: { tool: AITool; featured?: boolean }) {
  const colorClass = categoryColors[tool.category] || categoryColors['其他'];

  return (
    <a
      href={tool.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`group block bg-card rounded-xl border border-border/50 p-5 hover:border-primary/30 hover:shadow-sm transition-all ${
        featured ? 'border-primary/20 bg-primary/[0.02]' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        {/* 图标 */}
        {tool.icon_url ? (
          <img
            src={tool.icon_url}
            alt={tool.name}
            className="w-10 h-10 rounded-lg object-contain bg-muted/50 p-1.5 shrink-0"
          />
        ) : (
          <div className="w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center text-lg shrink-0">
            {categoryEmoji[tool.category] || '🔧'}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
              {tool.name}
            </h3>
            <ExternalLink className="w-3 h-3 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
            {tool.description || '暂无描述'}
          </p>
          <span className={`inline-block px-2 py-0.5 text-[11px] font-medium rounded border ${colorClass}`}>
            {tool.category}
          </span>
        </div>
      </div>
    </a>
  );
}
