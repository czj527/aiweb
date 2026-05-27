'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Search, Filter } from 'lucide-react';

interface ModelScore {
  source: string;
  category: string;
  categoryLabel: string;
  score: number;
  rankPosition: number;
  rankChange: number;
}

interface ModelCard {
  modelName: string;
  developer: string;
  parameters: string;
  description: string;
  bestRank: number;
  bestScore: number;
  bestCategory: string;
  scores: ModelScore[];
  color: string;
}

interface ModelsClientProps {
  initialModels: ModelCard[];
  developers: string[];
  categories: Array<{ key: string; label: string }>;
}

export function ModelsClient({ initialModels, developers, categories }: ModelsClientProps) {
  const [search, setSearch] = useState('');
  const [selectedDev, setSelectedDev] = useState<string>('');
  const [selectedCat, setSelectedCat] = useState<string>('');

  const filtered = initialModels.filter((m) => {
    if (search && !m.modelName.toLowerCase().includes(search.toLowerCase()) && !m.developer.toLowerCase().includes(search.toLowerCase())) return false;
    if (selectedDev && m.developer !== selectedDev) return false;
    if (selectedCat && !m.scores.some((s) => s.category === selectedCat)) return false;
    return true;
  });

  return (
    <main className="max-w-5xl mx-auto px-8 py-8">
      <div className="flex items-center gap-4 mb-8 border-b border-border/30 pb-6">
        <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
          <ArrowLeft className="w-4 h-4 inline mr-1 -mt-0.5" />首页
        </Link>
        <span className="text-border">|</span>
        <span className="text-xs text-muted-foreground font-semibold uppercase tracking-widest">模型库</span>
      </div>

      {/* 筛选栏 */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="搜索模型..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm bg-card border border-border/30 rounded-lg focus:outline-none focus:border-primary/50"
          />
        </div>
        <select
          value={selectedDev}
          onChange={(e) => setSelectedDev(e.target.value)}
          className="px-3 py-2 text-sm bg-card border border-border/30 rounded-lg focus:outline-none focus:border-primary/50"
        >
          <option value="">全部厂商</option>
          {developers.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select
          value={selectedCat}
          onChange={(e) => setSelectedCat(e.target.value)}
          className="px-3 py-2 text-sm bg-card border border-border/30 rounded-lg focus:outline-none focus:border-primary/50"
        >
          <option value="">全部类别</option>
          {categories.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
      </div>

      {/* 统计 */}
      <p className="text-xs text-muted-foreground mb-4">共 {filtered.length} 个模型</p>

      {/* 模型卡片 */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">暂无模型数据</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((model) => (
            <div
              key={model.modelName}
              className="p-5 bg-card rounded-xl border border-border/30 hover:border-primary/30 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{model.modelName}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{model.developer}</p>
                </div>
                <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ backgroundColor: model.color + '15', color: model.color }}>
                  #{model.bestRank}
                </span>
              </div>
              {model.description && (
                <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{model.description}</p>
              )}
              <div className="flex flex-wrap gap-1.5">
                {model.scores.slice(0, 3).map((s) => (
                  <span key={`${s.source}-${s.category}`} className="text-[11px] px-1.5 py-0.5 bg-muted rounded">
                    {s.categoryLabel} {s.score}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
