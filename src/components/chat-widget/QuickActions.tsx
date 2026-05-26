'use client';

import { cn } from '@/lib/utils';

// 公开页面快捷按钮
const PUBLIC_ACTIONS = [
  { label: '今日要闻', intent: 'today-news' as const },
  { label: '热门模型', intent: 'hot-models' as const },
  { label: '工具推荐', intent: 'tools' as const },
  { label: '本周周报', intent: 'weekly' as const },
];

// 管理后台快捷按钮
const ADMIN_ACTIONS = [
  { label: '同步资讯', intent: 'sync-juya' as const },
  { label: '生成日报', intent: 'gen-daily' as const },
  { label: '撰写周报', intent: 'gen-weekly' as const },
  { label: '系统状态', intent: 'status' as const },
];

interface QuickActionsProps {
  role: 'public' | 'admin';
  onAction: (intent: string) => void;
  disabled?: boolean;
}

export function QuickActions({ role, onAction, disabled = false }: QuickActionsProps) {
  const actions = role === 'admin' ? ADMIN_ACTIONS : PUBLIC_ACTIONS;

  return (
    <div className="flex flex-wrap gap-1.5 px-4 py-2">
      {actions.map((action) => (
        <button
          key={action.intent}
          onClick={() => onAction(action.intent)}
          disabled={disabled}
          className={cn(
            'px-3 py-1.5 text-xs rounded-full border border-border/50',
            'bg-card text-muted-foreground hover:text-foreground hover:border-border',
            'transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
          )}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}
