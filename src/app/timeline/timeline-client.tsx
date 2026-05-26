'use client';

import { useState, useEffect, useRef } from 'react';
import { Clock } from 'lucide-react';

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
  5: 160,
  4: 120,
  3: 80,
  2: 50,
  1: 30,
};

const DOT_SIZES: Record<number, number> = {
  5: 16,
  4: 14,
  3: 10,
  2: 8,
  1: 6,
};

const YEAR_WIDTH = 600;
const START_YEAR = 1920;
const START_POS = 40;
const MAIN_LINE_TOP = 300;

// ─── Component ──────────────────────────────────────────────────────

export function TimelineClient({ initialMilestones }: { initialMilestones: Milestone[] }) {
  const [milestones, setMilestones] = useState<Milestone[]>(initialMilestones);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedImportance, setSelectedImportance] = useState<string>('all');
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [hasScrolled, setHasScrolled] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);
  const hasInitialized = useRef(false);

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

  // 初始滚动到 2017 位置
  useEffect(() => {
    if (hasInitialized.current) return;
    if (milestones.length === 0) return;
    
    // 计算 2017 年的位置
    const targetYear = 2017;
    const targetPos = START_POS + (targetYear - START_YEAR) * YEAR_WIDTH;
    const containerWidth = containerRef.current?.clientWidth || 1200;
    const scrollToPos = Math.max(0, targetPos - containerWidth / 2);
    
    // 延迟执行确保容器已渲染
    const timer = setTimeout(() => {
      if (containerRef.current) {
        containerRef.current.scrollLeft = scrollToPos;
        hasInitialized.current = true;
        setHasScrolled(true);
      }
    }, 100);
    
    return () => clearTimeout(timer);
  }, [milestones]);

  // 计算事件位置
  const getEventPosition = (dateStr: string) => {
    const [year, month] = dateStr.split('-').map(Number);
    return START_POS + (year - START_YEAR) * YEAR_WIDTH + (month / 12) * YEAR_WIDTH;
  };

  // 格式化日期显示
  const formatDate = (dateStr: string, importance: number) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    if (importance >= 5 && day) {
      return `${year}.${month}.${day}`;
    } else if (importance >= 3 && month) {
      return `${year}.${month}`;
    }
    return String(year);
  };

  // 筛选事件
  const filteredMilestones = milestones.filter(m => {
    if (selectedCategory !== 'all' && m.category !== selectedCategory) return false;
    if (selectedImportance !== 'all' && m.importance !== parseInt(selectedImportance)) return false;
    return true;
  });

  // 拖拽滚动
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.event-card')) return;
    isDragging.current = true;
    startX.current = e.pageX - (containerRef.current?.offsetLeft || 0);
    scrollLeft.current = containerRef.current?.scrollLeft || 0;
    if (containerRef.current) containerRef.current.style.cursor = 'grabbing';
  };

  const handleMouseUp = () => {
    isDragging.current = false;
    if (containerRef.current) containerRef.current.style.cursor = 'default';
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    e.preventDefault();
    const x = e.pageX - (containerRef.current?.offsetLeft || 0);
    const walk = (x - startX.current) * 1.5;
    if (containerRef.current) {
      containerRef.current.scrollLeft = scrollLeft.current - walk;
    }
  };

  // 滚轮横向滚动
  const handleWheel = (e: React.WheelEvent) => {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && containerRef.current) {
      e.preventDefault();
      containerRef.current.scrollLeft += e.deltaY;
    }
  };

  // 滚动检测
  const handleScroll = () => {
    if (containerRef.current && containerRef.current.scrollLeft > 100 && !hasScrolled) {
      setHasScrolled(true);
    }
  };

  // 切换卡片展开/收起
  const toggleCard = (id: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // 总宽度
  const totalWidth = (2026 - START_YEAR + 1) * YEAR_WIDTH + 80;

  return (
    <div className="min-h-screen bg-background font-sans">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border/30 px-4 sm:px-6 py-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5">
            {/* 标题 */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold font-display text-foreground">AI 发展时间线</h1>
                <p className="text-sm text-muted-foreground">从 1920 年至今的 AI 演进历程</p>
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

          {/* 筛选器 */}
          <div className="flex flex-wrap gap-2 items-center">
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

      {/* 时间线容器 - 增加顶部 padding 避免被导航栏遮挡 */}
      <div
        ref={containerRef}
        className="overflow-x-auto overflow-y-visible cursor-grab active:cursor-grabbing scrollbar-thin scrollbar-thumb-[#c9ada7] scrollbar-track-[#e5e5e5]"
        style={{ scrollbarWidth: 'thin', scrollbarColor: '#c9ada7 #e5e5e5' }}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onMouseMove={handleMouseMove}
        onWheel={handleWheel}
        onScroll={handleScroll}
      >
        <div
          className="relative pt-16"
          style={{ width: `${totalWidth}px`, minHeight: '600px', paddingBottom: '120px', paddingTop: '100px' }}
        >
          {/* 时间轴主线 */}
          <div
            className="absolute left-0 right-0 h-0.5 bg-[#d1d5db] rounded"
            style={{ top: `${MAIN_LINE_TOP}px` }}
          />

          {/* 年份标记 - 只显示关键年份 */}
          <div className="absolute left-0 right-0 flex justify-between" style={{ top: `${MAIN_LINE_TOP + 40}px` }}>
            {[1920, 1930, 1940, 1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020, 2026].map(year => (
              <div
                key={year}
                className="relative font-display text-sm font-bold text-muted-foreground"
                style={{ transform: 'translateX(-50%)' }}
              >
                {year}
                <div
                  className="absolute w-0.5 h-3 bg-[#d1d5db]"
                  style={{ top: '-20px', left: '50%' }}
                />
              </div>
            ))}
          </div>

          {/* 季度刻度 - 只显示 2000 年后的 */}
          <div className="absolute left-0 right-0" style={{ top: `${MAIN_LINE_TOP + 25}px` }}>
            {Array.from({ length: 27 }, (_, i) => START_YEAR + i).flatMap(year =>
              [1, 2, 3, 4].map(q => (
                <div
                  key={`${year}-Q${q}`}
                  className="absolute text-[8px] text-muted-foreground/40"
                  style={{ left: `${START_POS + (year - START_YEAR) * YEAR_WIDTH + (q - 1) * (YEAR_WIDTH / 4)}px` }}
                >
                  Q{q}
                </div>
              ))
            )}
          </div>

          {/* 事件组 */}
          {filteredMilestones.map((milestone, index) => {
            const xPos = getEventPosition(milestone.date);
            const color = CATEGORY_COLORS[milestone.category];
            const lineHeight = LINE_HEIGHTS[milestone.importance] || 80;
            const dotSize = DOT_SIZES[milestone.importance] || 10;
            const isExpanded = expandedCards.has(milestone.id);

            return (
              <div
                key={milestone.id}
                className="absolute transition-all duration-300 event-card cursor-pointer"
                style={{
                  left: `${xPos}px`,
                  top: `${MAIN_LINE_TOP - lineHeight}px`,
                  transform: 'translateX(-50%)',
                  color,
                  opacity: 0,
                  animation: `fadeSlideIn 0.4s ease forwards`,
                  animationDelay: `${Math.min(index * 30, 500)}ms`,
                }}
                onClick={() => toggleCard(milestone.id)}
              >
                {/* 竖线：从圆点（主线位置）向上延伸 */}
                <div
                  className="absolute left-1/2 -translate-x-1/2 w-0.5 bg-current transition-all duration-300"
                  style={{
                    top: 0,
                    height: isExpanded ? `${lineHeight + 120}px` : `${lineHeight}px`,
                  }}
                />

                {/* 圆点：紧贴竖线顶端（在主线上） */}
                <div
                  className="absolute left-1/2 -translate-x-1/2 rounded-full transition-transform duration-200 hover:scale-130"
                  style={{
                    top: 0,
                    width: `${dotSize}px`,
                    height: `${dotSize}px`,
                    backgroundColor: 'currentColor',
                  }}
                />

                {/* 日期标签：在圆点上方 */}
                <div
                  className={`absolute left-1/2 -translate-x-1/2 text-center transition-all whitespace-nowrap pointer-events-none ${
                    milestone.importance >= 5
                      ? 'text-[11px] font-bold opacity-90'
                      : milestone.importance >= 4
                      ? 'text-[10px] font-semibold'
                      : milestone.importance >= 3
                      ? 'text-[9px]'
                      : 'text-[8px] opacity-70'
                  }`}
                  style={{ top: `-${lineHeight + 15}px`, color: 'inherit' }}
                >
                  {formatDate(milestone.date, milestone.importance)}
                </div>

                {/* 标题：在日期下方 */}
                <div
                  className={`absolute left-1/2 -translate-x-1/2 text-center transition-all whitespace-nowrap pointer-events-none ${
                    milestone.importance >= 5
                      ? 'text-[10px] font-semibold'
                      : 'text-[9px] opacity-75'
                  }`}
                  style={{ top: `-${lineHeight + 30}px`, color: 'inherit' }}
                >
                  {milestone.title.length > 15 ? milestone.title.slice(0, 15) + '...' : milestone.title}
                </div>

                {/* 展开卡片：默认隐藏，点击后显示完整描述 */}
                <div
                  className={`absolute left-1/2 -translate-x-1/2 bg-card rounded-xl border-l-[3px] shadow-lg p-3.5 min-w-[200px] max-w-[280px] transition-all duration-300 ${
                    isExpanded ? 'opacity-100 scale-100' : 'opacity-0 scale-90 pointer-events-none'
                  }`}
                  style={{
                    top: `-${lineHeight + 130}px`,
                    borderLeftColor: color,
                  }}
                >
                  <div className="text-[11px] font-semibold opacity-70 mb-1.5">
                    {milestone.date}
                  </div>
                  <div className="text-sm font-bold text-foreground mb-1.5 leading-snug">
                    {milestone.title}
                  </div>
                  {milestone.description && (
                    <div className="text-xs text-muted-foreground mb-2.5 leading-relaxed">
                      {milestone.description}
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
              </div>
            );
          })}
        </div>
      </div>

      {/* 滚动提示 */}
      <div
        className={`fixed bottom-8 right-8 bg-card px-5 py-3 rounded-full shadow-lg text-sm text-muted-foreground flex items-center gap-2 z-50 transition-opacity ${
          hasScrolled ? 'opacity-0 pointer-events-none' : 'opacity-100 animate-bounce'
        }`}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
        左右滑动探索时间线
      </div>

      {/* 入场动画 */}
      <style jsx global>{`
        @keyframes fadeSlideIn {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
