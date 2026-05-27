'use client';

import { useState } from 'react';
import { Clock, ChevronLeft, ChevronRight } from 'lucide-react';

interface Milestone {
  id: string;
  date: string;
  title: string;
  description: string;
  category: 'breakthrough' | 'model' | 'product' | 'opensource' | 'event' | 'regulation';
  importance: number;
}

const MILESTONES: Milestone[] = [
  // 2022
  { id: 'm-2022-01', date: '2022-04-06', title: 'DALL·E 2 发布', description: 'OpenAI 发布 DALL·E 2，能根据文本生成逼真图像，标志着 AI 图像生成进入实用阶段。', category: 'model', importance: 5 },
  { id: 'm-2022-02', date: '2022-07-12', title: 'Stable Diffusion 开源', description: 'Stability AI 发布 Stable Diffusion 并开源权重，引爆开源 AI 图像生成浪潮。', category: 'opensource', importance: 5 },
  { id: 'm-2022-03', date: '2022-11-30', title: 'ChatGPT 发布', description: 'OpenAI 发布 ChatGPT（GPT-3.5），两个月内用户破亿，开启 AI 对话时代。', category: 'model', importance: 5 },
  { id: 'm-2022-04', date: '2022-03-24', title: 'PaLM 发布', description: 'Google 发布 5400 亿参数的 PaLM 模型，在多项基准测试上超越人类。', category: 'model', importance: 4 },
  { id: 'm-2022-05', date: '2022-08-01', title: 'Midjourney 公测', description: 'Midjourney 开放公测，成为最受欢迎的 AI 绘画工具之一。', category: 'product', importance: 3 },
  { id: 'm-2022-06', date: '2022-05-01', title: 'OPT-175B 开源', description: 'Meta 发布 OPT-175B 开源大语言模型，推动开源 LLM 研究。', category: 'opensource', importance: 3 },
  // 2023
  { id: 'm-2023-01', date: '2023-03-14', title: 'GPT-4 发布', description: 'OpenAI 发布 GPT-4，支持多模态输入，在专业考试中表现接近人类顶尖水平。', category: 'model', importance: 5 },
  { id: 'm-2023-02', date: '2023-07-18', title: 'Claude 2 发布', description: 'Anthropic 发布 Claude 2，支持 100K 上下文窗口，安全性大幅提升。', category: 'model', importance: 4 },
  { id: 'm-2023-03', date: '2023-02-24', title: 'LLaMA 开源', description: 'Meta 发布 LLaMA 系列模型并逐步开源，掀起开源大模型竞赛。', category: 'opensource', importance: 5 },
  { id: 'm-2023-04', date: '2023-07-19', title: 'LLaMA 2 开源', description: 'Meta 发布 LLaMA 2 并开放商用许可，开源大模型进入商用时代。', category: 'opensource', importance: 4 },
  { id: 'm-2023-05', date: '2023-05-10', title: 'PaLM 2 发布', description: 'Google 发布 PaLM 2，驱动 Bard 和多项 Google AI 产品。', category: 'model', importance: 3 },
  { id: 'm-2023-06', date: '2023-03-21', title: 'Midjourney V5 发布', description: 'Midjourney V5 发布，图像质量大幅提升，几乎无法与真实照片区分。', category: 'product', importance: 3 },
  { id: 'm-2023-07', date: '2023-12-06', title: 'Gemini 发布', description: 'Google DeepMind 发布 Gemini 1.0，原生多模态模型，在多项基准上超越 GPT-4。', category: 'model', importance: 5 },
  { id: 'm-2023-08', date: '2023-11-06', title: 'GPTs 上线', description: 'OpenAI 推出 GPTs 和 GPT Store，用户可自定义 AI 助手，平台化战略开启。', category: 'product', importance: 4 },
  { id: 'm-2023-09', date: '2023-10-17', title: 'Claude 2.1 发布', description: 'Anthropic 发布 Claude 2.1，支持 200K 上下文窗口，幻觉率降低 50%。', category: 'model', importance: 3 },
  { id: 'm-2023-10', date: '2023-11-29', title: 'Pika 1.0 发布', description: 'Pika Labs 发布 Pika 1.0，AI 视频生成进入实用阶段。', category: 'product', importance: 3 },
  // 2024
  { id: 'm-2024-01', date: '2024-02-15', title: 'Sora 发布', description: 'OpenAI 发布 Sora 视频生成模型，能生成长达一分钟的高质量视频，震惊业界。', category: 'model', importance: 5 },
  { id: 'm-2024-02', date: '2024-03-04', title: 'Claude 3 发布', description: 'Anthropic 发布 Claude 3 系列（Haiku/Sonnet/Opus），Opus 在多项评测中超越 GPT-4。', category: 'model', importance: 5 },
  { id: 'm-2024-03', date: '2024-05-13', title: 'GPT-4o 发布', description: 'OpenAI 发布 GPT-4o，原生多模态，速度提升 2 倍，价格降低 50%。', category: 'model', importance: 5 },
  { id: 'm-2024-04', date: '2024-04-18', title: 'Llama 3 发布', description: 'Meta 发布 Llama 3（8B/70B），开源模型首次在同规模超越 GPT-3.5。', category: 'opensource', importance: 4 },
  { id: 'm-2024-05', date: '2024-02-21', title: 'Gemini 1.5 Pro 发布', description: 'Google 发布 Gemini 1.5 Pro，支持 100 万 token 超长上下文窗口。', category: 'model', importance: 4 },
  { id: 'm-2024-06', date: '2024-06-20', title: 'Claude 3.5 Sonnet 发布', description: 'Anthropic 发布 Claude 3.5 Sonnet，性能超越 Claude 3 Opus，速度提升 5 倍。', category: 'model', importance: 4 },
  { id: 'm-2024-07', date: '2024-07-22', title: 'GPT-4o mini 发布', description: 'OpenAI 发布 GPT-4o mini，替代 GPT-3.5 Turbo，性价比大幅提升。', category: 'model', importance: 3 },
  { id: 'm-2024-08', date: '2024-09-12', title: 'o1 推理模型发布', description: 'OpenAI 发布 o1 推理模型，引入思维链推理，在数学和编程任务上表现突破性提升。', category: 'model', importance: 5 },
  { id: 'm-2024-09', date: '2024-12-09', title: 'Gemini 2.0 发布', description: 'Google 发布 Gemini 2.0 Flash，引入原生工具使用和 Agent 能力。', category: 'model', importance: 4 },
  { id: 'm-2024-10', date: '2024-12-20', title: 'o3 推理模型发布', description: 'OpenAI 发布 o3，在 ARC-AGI 基准上达到 87.5% 准确率，展现超强推理能力。', category: 'model', importance: 5 },
  { id: 'm-2024-11', date: '2024-07-01', title: 'Cursor 爆发', description: 'AI 编程助手 Cursor 用户量爆发式增长，AI 辅助编程成为开发者标配。', category: 'product', importance: 4 },
  { id: 'm-2024-12', date: '2024-03-01', title: 'EU AI Act 通过', description: '欧盟通过《人工智能法案》，成为全球首个全面监管 AI 的法律框架。', category: 'regulation', importance: 4 },
  // 2025
  { id: 'm-2025-01', date: '2025-01-20', title: 'DeepSeek-R1 发布', description: 'DeepSeek 发布 R1 推理模型，性能媲美 o1 但完全开源，震动全球 AI 行业。', category: 'opensource', importance: 5 },
  { id: 'm-2025-02', date: '2025-01-27', title: 'DeepSeek 登顶 App Store', description: 'DeepSeek 应用登顶美国 App Store 免费榜，引发全球关注和芯片股暴跌。', category: 'event', importance: 5 },
  { id: 'm-2025-03', date: '2025-02-25', title: 'Claude 3.7 Sonnet 发布', description: 'Anthropic 发布 Claude 3.7 Sonnet，首个混合推理模型，支持扩展思考。', category: 'model', importance: 4 },
  { id: 'm-2025-04', date: '2025-03-25', title: 'GPT-4o 原生图像生成', description: 'OpenAI 为 GPT-4o 添加原生图像生成能力，文本渲染质量大幅提升。', category: 'product', importance: 4 },
  { id: 'm-2025-05', date: '2025-04-14', title: 'Claude Opus 4 发布', description: 'Anthropic 发布 Claude Opus 4 和 Sonnet 4，在编码和 Agent 任务上达到新高度。', category: 'model', importance: 5 },
  { id: 'm-2025-06', date: '2025-05-06', title: 'Gemini 2.5 Pro 发布', description: 'Google 发布 Gemini 2.5 Pro，在多项评测中排名第一，原生多模态能力领先。', category: 'model', importance: 4 },
  { id: 'm-2025-07', date: '2025-03-01', title: 'Manus Agent 发布', description: '国产 AI Agent 产品 Manus 发布，能自主完成复杂任务，Agent 赛道升温。', category: 'product', importance: 3 },
  { id: 'm-2025-08', date: '2025-04-01', title: 'MCP 协议流行', description: 'Anthropic 提出的 Model Context Protocol (MCP) 获广泛采纳，成为 AI 工具调用标准。', category: 'event', importance: 4 },
  // 2026
  { id: 'm-2026-01', date: '2026-01-15', title: 'AI Agent 爆发年', description: '2026 年成为 AI Agent 元年，各大厂商纷纷推出自主 Agent 产品。', category: 'event', importance: 4 },
  { id: 'm-2026-02', date: '2026-03-01', title: 'Claude Opus 4.6 发布', description: 'Anthropic 发布 Claude Opus 4.6，在 Agent 和编码任务上持续领先。', category: 'model', importance: 4 },
  { id: 'm-2026-03', date: '2026-04-01', title: 'GPT-5 发布', description: 'OpenAI 发布 GPT-5，推理能力大幅提升，支持更长上下文和更复杂的任务。', category: 'model', importance: 5 },
];

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
  5: 140, 4: 105, 3: 70, 2: 45, 1: 25,
};

const DOT_SIZES: Record<number, number> = {
  5: 16, 4: 14, 3: 10, 2: 8, 1: 6,
};

const AVAILABLE_YEARS = [2022, 2023, 2024, 2025, 2026];
const MAIN_LINE_TOP = 200;
const MONTH_WIDTH = 70;
const PADDING_LEFT = 50;

export function TimelineClient() {
  const [currentYear, setCurrentYear] = useState(2025);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedImportance, setSelectedImportance] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  const getEventX = (dateStr: string) => {
    const parts = dateStr.split('-');
    if (parts.length < 2) return PADDING_LEFT + 6 * MONTH_WIDTH;
    const month = parseInt(parts[1], 10);
    const day = parts.length >= 3 ? parseInt(parts[2], 10) : 15;
    return PADDING_LEFT + (month - 1) * MONTH_WIDTH + ((day || 15) / 31) * MONTH_WIDTH;
  };

  const formatDate = (dateStr: string) => {
    const parts = dateStr.split('-');
    if (parts.length < 2) return dateStr;
    return `${parseInt(parts[0], 10)}.${parseInt(parts[1], 10)}${parts.length >= 3 && parts[2] ? `.${parseInt(parts[2], 10)}` : ''}`;
  };

  const yearMilestones = MILESTONES.filter(m => {
    const year = new Date(m.date).getFullYear();
    if (year !== currentYear) return false;
    if (selectedCategory !== 'all' && m.category !== selectedCategory) return false;
    if (selectedImportance !== 'all' && m.importance !== parseInt(selectedImportance)) return false;
    return true;
  });

  const goToYear = (year: number) => {
    if (year === currentYear) return;
    setIsAnimating(true);
    setExpandedId(null);
    setTimeout(() => { setCurrentYear(year); setIsAnimating(false); }, 150);
  };

  const prevYear = () => {
    const idx = AVAILABLE_YEARS.indexOf(currentYear);
    if (idx > 0) goToYear(AVAILABLE_YEARS[idx - 1]);
  };

  const nextYear = () => {
    const idx = AVAILABLE_YEARS.indexOf(currentYear);
    if (idx < AVAILABLE_YEARS.length - 1) goToYear(AVAILABLE_YEARS[idx + 1]);
  };

  const totalWidth = PADDING_LEFT + 12 * MONTH_WIDTH + 50;

  return (
    <div className="min-h-screen bg-background font-sans">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border/30 px-4 sm:px-6 py-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold font-display text-foreground">AI 发展时间线</h1>
                <p className="text-sm text-muted-foreground">从 2022 年至今的 AI 演进历程</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">颜色 = 类型</span>
                <div className="flex gap-1">
                  {Object.entries(CATEGORY_COLORS).map(([key, color]) => (
                    <div key={key} className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">高度 = 重要度</span>
                <div className="flex items-end gap-0.5">
                  {[1, 2, 3, 4, 5].map(h => (
                    <div key={h} className="w-1.5 bg-muted-foreground/40 rounded-sm" style={{ height: `${8 + h * 4}px` }} />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-1 mb-4">
            <button onClick={prevYear} disabled={currentYear <= AVAILABLE_YEARS[0]}
              className="p-2 rounded-lg hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            {AVAILABLE_YEARS.map(year => (
              <button key={year} onClick={() => goToYear(year)}
                className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${
                  currentYear === year ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-accent text-muted-foreground'
                }`}>
                {year}
              </button>
            ))}
            <button onClick={nextYear} disabled={currentYear >= AVAILABLE_YEARS[AVAILABLE_YEARS.length - 1]}
              className="p-2 rounded-lg hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="flex flex-wrap gap-2 items-center justify-center">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">类型:</span>
              {['all', 'breakthrough', 'model', 'product', 'opensource', 'event', 'regulation'].map(cat => (
                <button key={cat} onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 text-xs font-medium rounded-full border transition-all ${
                    selectedCategory === cat
                      ? cat === 'all' ? 'bg-foreground text-background border-foreground' : 'text-white border-transparent'
                      : 'bg-card text-muted-foreground border-border/50 hover:border-primary/30 hover:text-foreground'
                  }`}
                  style={selectedCategory === cat && cat !== 'all' ? { backgroundColor: CATEGORY_COLORS[cat] } : undefined}>
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
                <button key={val} onClick={() => setSelectedImportance(val)}
                  className={`px-3 py-1 text-xs font-medium rounded-full border transition-all ${
                    selectedImportance === val
                      ? 'bg-foreground text-background border-foreground'
                      : 'bg-card text-muted-foreground border-border/50 hover:border-primary/30 hover:text-foreground'
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div
          className={`relative transition-opacity duration-150 ${isAnimating ? 'opacity-0' : 'opacity-100'}`}
          style={{ width: `${totalWidth}px`, height: '500px', margin: '0 auto' }}
        >
          <div className="absolute left-0 right-0 h-0.5 bg-border rounded" style={{ top: MAIN_LINE_TOP }} />

          <div className="absolute left-0 right-0 flex" style={{ top: MAIN_LINE_TOP + 15 }}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
              <div key={month} style={{ width: MONTH_WIDTH, textAlign: 'center' }} className="text-xs text-muted-foreground">
                {month}月
              </div>
            ))}
          </div>

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
                style={{ left: `${x}px`, top: 0, transform: 'translateX(-50%)', width: 0 }}
                onClick={() => setExpandedId(isExpanded ? null : milestone.id)}
              >
                <div
                  className="absolute left-1/2 -translate-x-1/2 w-0.5"
                  style={{
                    top: `${MAIN_LINE_TOP - lineHeight}px`,
                    height: `${lineHeight}px`,
                    backgroundColor: color,
                  }}
                />

                <div
                  className="absolute left-1/2 -translate-x-1/2 rounded-full transition-transform duration-200 group-hover:scale-125"
                  style={{
                    top: `${MAIN_LINE_TOP - lineHeight - dotSize / 2}px`,
                    width: `${dotSize}px`,
                    height: `${dotSize}px`,
                    backgroundColor: color,
                  }}
                />

                <div
                  className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity text-xs z-20"
                  style={{ top: `${MAIN_LINE_TOP - lineHeight - dotSize / 2 - 32}px` }}
                >
                  <span className="bg-popover text-popover-foreground px-2 py-1 rounded shadow-lg border border-border/50">
                    {formatDate(milestone.date)} {milestone.title}
                  </span>
                </div>

                <div
                  className={`absolute left-1/2 -translate-x-1/2 bg-card rounded-xl border-l-[3px] shadow-lg p-4 min-w-[240px] max-w-[300px] z-10 transition-all duration-200 ${
                    isExpanded ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'
                  }`}
                  style={{ top: `${MAIN_LINE_TOP + 25}px`, borderLeftColor: color }}
                >
                  <div className="text-xs font-semibold opacity-70 mb-1">{milestone.date}</div>
                  <div className="text-sm font-bold text-foreground mb-1.5 leading-snug">{milestone.title}</div>
                  {milestone.description && (
                    <div className="text-xs text-muted-foreground mb-2 leading-relaxed">
                      {milestone.description}
                    </div>
                  )}
                  <span className="inline-block px-2 py-0.5 text-[10px] font-semibold rounded-full"
                    style={{ backgroundColor: `${color}20`, color }}>
                    {CATEGORY_NAMES[milestone.category]}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {yearMilestones.length === 0 && (
          <div className="text-center py-20 text-muted-foreground">
            {currentYear} 年暂无记录的 AI 里程碑事件
          </div>
        )}

        {yearMilestones.length > 0 && (
          <div className="text-center mt-4 text-sm text-muted-foreground">
            共 {yearMilestones.length} 个里程碑事件
          </div>
        )}
      </div>
    </div>
  );
}
