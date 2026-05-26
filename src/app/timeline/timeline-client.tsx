'use client';

import { useState, useEffect } from 'react';
import { Clock, ChevronLeft, ChevronRight } from 'lucide-react';

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

// ─── Constants ───────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  breakthrough: '#8b5cf6',
  model: '#3b82f6',
  product: '#10b981',
  opensource: '#06b6d4',
  event: '#f59e0b',
  regulation: '#ef4444',
};

const CATEGORY_NAMES: Record<string, string> = {
  breakthrough: '技术突破',
  model: '模型',
  product: '产品',
  opensource: '开源',
  event: '行业事件',
  regulation: '政策监管',
};

const LINE_HEIGHTS: Record<number, number> = {
  5: 140,
  4: 105,
  3: 70,
  2: 45,
  1: 25,
};

const DOT_SIZES: Record<number, number> = {
  5: 16,
  4: 14,
  3: 10,
  2: 8,
  1: 6,
};

const AVAILABLE_YEARS = [2022, 2023, 2024, 2025, 2026];
const MAIN_LINE_TOP = 200; // 主线 y 位置（给上方竖线留空间）
const MONTH_WIDTH = 80; // 每月宽度
const TOTAL_WIDTH = 60 + 12 * MONTH_WIDTH + 60; // 左右留白 + 12个月

// ─── Component ──────────────────────────────────────────────────────

export function TimelineClient({ initialMilestones }: { initialMilestones: Milestone[] }) {
  const [milestones, setMilestones] = useState<Milestone[]>(initialMilestones);
  const [currentYear, setCurrentYear] = useState(2022);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedImportance, setSelectedImportance] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  // 如果初始数据为空，从 API 获取
  useEffect(() => {
    if (initialMilestones.length === 0) {
      fetch('/api/milestones')
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data)) setMilestones(data);
        })
        .catch(() => {});
    }
  }, [initialMilestones]);

  // 计算事件的 x 位置（基于月份和日期）
  const getEventX = (dateStr: string) => {
    const parts = dateStr.split('-');
    if (parts.length < 2) return 60 + 6 * MONTH_WIDTH;
    const month = parseInt(parts[1], 10);
    const day = parts.length >= 3 ? parseInt(parts[2], 10) : 15;
    return 60 + (month - 1) * MONTH_WIDTH + ((day || 15) / 30) * MONTH_WIDTH;
  };

  // 格式化日期显示
  const formatDate = (dateStr: string) => {
    const parts = dateStr.split('-');
    if (parts.length < 2) return dateStr;
    return `${parseInt(parts[0], 10)}.${parseInt(parts[1], 10)}${parts.length >= 3 && parts[2] ? `.${parseInt(parts[2], 10)}` : ''}`;
  };

  // 筛选当前年份的事件
  const yearMilestones = milestones.filter(m => {
    const year = new Date(m.date).getFullYear();
    if (year !== currentYear) return false;
    if (selectedCategory !== 'all' && m.category !== selectedCategory) return false;
    if (selectedImportance !== 'all' && m.importance !== parseInt(selectedImportance)) return false;
    return true;
  });

  // 年份切换
  const goToYear = (year: number) => {
    if (year === currentYear) return;
    setIsAnimating(true);
    setExpandedId(null);
    setTimeout(() => {
      setCurrentYear(year);
      setIsAnimating(false);
    }, 150);
  };

  const prevYear = () => {
    const idx = AVAILABLE_YEARS.indexOf(currentYear);
    if (idx > 0) goToYear(AVAILABLE_YEARS[idx - 1]);
  };

  const nextYear = () => {
    const idx = AVAILABLE_YEARS.indexOf(currentYear);
    if (idx < AVAILABLE_YEARS.length - 1) goToYear(AVAILABLE_YEARS[idx + 1]);
  };

  return (
    <div className="min-h-screen bg-background font-sans">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border/30 px-4 sm:px-6 py-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5">
            {/* 标题 */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold font-display text-foreground">AI 发展时间线</h1>
                <p className="text-sm text-muted-foreground">从 2022 年至今的 AI 演进历程</p>
              </div>
            </div>

            {/* 图例 */}
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">颜色 = 类型</span>
                <div className="flex gap-1">
                  {Object.entries(CATEGORY_COLORS).map(([key, color]) => (
                    <div
                      key={key}
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">高度 = 重要度</span>
                <div className="flex items-end gap-0.5">
                  {[1, 2, 3, 4, 5].map(h => (
                    <div
                      key={h}
                      className="w-1.5 bg-muted-foreground/40 rounded-sm"
                      style={{ height: `${8 + h * 4}px` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 年份选择器 */}
          <div className="flex items-center justify-center gap-1 mb-4">
            <button
              onClick={prevYear}
              disabled={currentYear <= AVAILABLE_YEARS[0]}
              className="p-2 rounded-lg hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="上一年"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            {AVAILABLE_YEARS.map(year => (
              <button
                key={year}
                onClick={() => goToYear(year)}
                className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${
                  currentYear === year
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'hover:bg-accent text-muted-foreground'
                }`}
              >
                {year}
              </button>
            ))}
            <button
              onClick={nextYear}
              disabled={currentYear >= AVAILABLE_YEARS[AVAILABLE_YEARS.length - 1]}
              className="p-2 rounded-lg hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="下一年"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* 筛选器 */}
          <div className="flex flex-wrap gap-2 items-center justify-center">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">类型:</span>
              {['all', 'breakthrough', 'model', 'product', 'opensource', 'event', 'regulation'].map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 text-xs font-medium rounded-full border transition-all ${
                    selectedCategory === cat
                      ? cat === 'all'
                        ? 'bg-foreground text-background border-foreground'
                        : 'text-white border-transparent'
                      : 'bg-card text-muted-foreground border-border/50 hover:border-primary/30 hover:text-foreground'
                  }`}
                  style={selectedCategory === cat && cat !== 'all' ? { backgroundColor: CATEGORY_COLORS[cat] } : undefined}
                >
                  {cat === 'all' ? '全部' : CATEGORY_NAMES[cat]}
                </button>
              ))}
            </div>
            <div className="w-px h-4 bg-border" />
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">重要度:</span>
              {[
                { val: '5', label: '里程碑' },
                { val: '4', label: '重要' },
                { val: 'all', label: '全部' },
              ].map(({ val, label }) => (
                <button
                  key={val}
                  onClick={() => setSelectedImportance(val)}
                  className={`px-3 py-1 text-xs font-medium rounded-full border transition-all ${
                    selectedImportance === val
                      ? 'bg-foreground text-background border-foreground'
                      : 'bg-card text-muted-foreground border-border/50 hover:border-primary/30 hover:text-foreground'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* 时间线区域 */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div
          className={`relative transition-opacity duration-150 ${isAnimating ? 'opacity-0' : 'opacity-100'}`}
          style={{ width: `${TOTAL_WIDTH}px`, minHeight: '500px', margin: '0 auto' }}
        >
          {/* 主线 */}
          <div
            className="absolute left-0 right-0 h-0.5 bg-border rounded"
            style={{ top: MAIN_LINE_TOP }}
          />

          {/* 月份标记 - 在主线下方 */}
          <div className="absolute left-0 right-0 flex" style={{ top: MAIN_LINE_TOP + 15 }}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
              <div
                key={month}
                style={{ width: MONTH_WIDTH, textAlign: 'center' }}
                className="text-xs text-muted-foreground"
              >
                {month}月
              </div>
            ))}
          </div>

          {/* 事件 */}
          {yearMilestones.map((milestone) => {
            const x = getEventX(milestone.date);
            const color = CATEGORY_COLORS[milestone.category];
            const lineHeight = LINE_HEIGHTS[milestone.importance] || 70;
            const dotSize = DOT_SIZES[milestone.importance] || 10;
            const isExpanded = expandedId === milestone.id;

            return (
              <div
                key={milestone.id}
                className="absolute cursor-pointer group"
                style={{ left: `${x}px`, transform: 'translateX(-50%)' }}
                onClick={() => setExpandedId(isExpanded ? null : milestone.id)}
              >
                {/* 竖线：从主线上方延伸 */}
                <div
                  className="absolute left-1/2 -translate-x-1/2 w-0.5 bg-current"
                  style={{
                    bottom: MAIN_LINE_TOP,
                    height: `${lineHeight}px`,
                    color: color,
                  }}
                />

                {/* 圆点：竖线顶端 */}
                <div
                  className="absolute left-1/2 -translate-x-1/2 rounded-full transition-transform duration-200 group-hover:scale-125"
                  style={{
                    bottom: `${MAIN_LINE_TOP + lineHeight - dotSize / 2}px`,
                    width: dotSize,
                    height: dotSize,
                    backgroundColor: color,
                  }}
                />

                {/* hover tooltip：日期+标题 */}
                <div
                  className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity text-xs z-20"
                  style={{ bottom: `${MAIN_LINE_TOP + lineHeight + 8}px` }}
                >
                  <span className="bg-popover text-popover-foreground px-2 py-1 rounded shadow-lg border border-border/50">
                    {formatDate(milestone.date)} {milestone.title}
                  </span>
                </div>

                {/* 展开详情：在主线下方 */}
                {isExpanded && (
                  <div
                    className="absolute left-1/2 -translate-x-1/2 bg-card rounded-xl border-l-[3px] shadow-lg p-4 min-w-[240px] max-w-[300px] z-10 animate-in fade-in slide-in-from-top-2 duration-200"
                    style={{ top: `${MAIN_LINE_TOP + 25}px`, borderLeftColor: color }}
                  >
                    <div className="text-xs font-semibold opacity-70 mb-1">{milestone.date}</div>
                    <div className="text-sm font-bold text-foreground mb-1.5 leading-snug">{milestone.title}</div>
                    {milestone.description && (
                      <div className="text-xs text-muted-foreground mb-2 leading-relaxed">
                        {milestone.description.length > 150
                          ? milestone.description.slice(0, 150) + '...'
                          : milestone.description}
                      </div>
                    )}
                    <span
                      className="inline-block px-2 py-0.5 text-[10px] font-semibold rounded-full"
                      style={{
                        backgroundColor: `${color}20`,
                        color,
                      }}
                    >
                      {CATEGORY_NAMES[milestone.category]}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 无数据提示 */}
        {yearMilestones.length === 0 && (
          <div className="text-center py-20 text-muted-foreground">
            {currentYear} 年暂无记录的 AI 里程碑事件
          </div>
        )}

        {/* 统计信息 */}
        {yearMilestones.length > 0 && (
          <div className="text-center mt-8 text-sm text-muted-foreground">
            共 {yearMilestones.length} 个里程碑事件
          </div>
        )}
      </div>
    </div>
  );
}
