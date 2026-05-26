// 意图匹配 + 操作路由
// 公开页面：关键词匹配走模板API，不走LLM
// 管理后台：操作关键词直接调Admin API

export type PublicIntent =
  | 'today-news'
  | 'hot-models'
  | 'tools'
  | 'weekly'
  | 'free-chat';

export type AdminIntent =
  | 'sync-juya'
  | 'gen-daily'
  | 'gen-weekly'
  | 'sync-leaderboard'
  | 'status'
  | 'cleanup'
  | 'free-chat';

// ── 公开页面意图匹配 ──

const PUBLIC_PATTERNS: Array<{ patterns: string[]; intent: PublicIntent }> = [
  {
    patterns: ['新闻', '要闻', '日报', '今天', '今日', '最新', '资讯', '热点'],
    intent: 'today-news',
  },
  {
    patterns: ['模型', '排行', 'GPT', 'Claude', 'Llama', 'DeepSeek', 'Qwen', 'Gemini', '榜单', '排名'],
    intent: 'hot-models',
  },
  {
    patterns: ['工具', '推荐', '神器', '效率'],
    intent: 'tools',
  },
  {
    patterns: ['周报', '摘要', 'weekly', '本周', '总结'],
    intent: 'weekly',
  },
];

export function matchPublicIntent(message: string): PublicIntent {
  const lower = message.toLowerCase();
  for (const { patterns, intent } of PUBLIC_PATTERNS) {
    if (patterns.some((p) => lower.includes(p.toLowerCase()))) {
      return intent;
    }
  }
  return 'free-chat';
}

// ── 管理后台意图匹配 ──

const ADMIN_PATTERNS: Array<{ patterns: string[]; intent: AdminIntent }> = [
  {
    patterns: ['同步', '采集', '更新资讯', '拉取', 'juya', 'RSS'],
    intent: 'sync-juya',
  },
  {
    patterns: ['生成日报', '日报', 'daily'],
    intent: 'gen-daily',
  },
  {
    patterns: ['写周报', '撰写周报', '周报', 'weekly', '生成周报'],
    intent: 'gen-weekly',
  },
  {
    patterns: ['排行榜', 'leaderboard', '更新排行'],
    intent: 'sync-leaderboard',
  },
  {
    patterns: ['状态', '系统', 'status', '运行'],
    intent: 'status',
  },
  {
    patterns: ['清理', 'cleanup', '清除', '删除数据'],
    intent: 'cleanup',
  },
];

export function matchAdminIntent(message: string): AdminIntent {
  const lower = message.toLowerCase();
  for (const { patterns, intent } of ADMIN_PATTERNS) {
    if (patterns.some((p) => lower.includes(p.toLowerCase()))) {
      return intent;
    }
  }
  return 'free-chat';
}

// ── 操作执行 ──

export interface TemplateResult {
  text: string;
  link?: string;
}

/** 执行公开页面的模板查询（不走LLM） */
export async function executePublicIntent(
  intent: PublicIntent
): Promise<TemplateResult> {
  const base = typeof window !== 'undefined' ? '' : '';

  switch (intent) {
    case 'today-news': {
      try {
        const res = await fetch(`${base}/api/news/recent?days=1`);
        const data = await res.json();
        const items = data?.items || data || [];
        if (!Array.isArray(items) || items.length === 0) {
          return { text: '今天还没有新资讯，稍后再来看看吧 🕐', link: '/daily' };
        }
        const lines = items
          .slice(0, 5)
          .map(
            (n: { title?: string }, i: number) =>
              `${i + 1}. ${n.title || '未知标题'}`
          );
        return {
          text: `📰 今日${items.length}条要闻：\n${lines.join('\n')}${
            items.length > 5 ? `\n...还有${items.length - 5}条` : ''
          }`,
          link: '/daily',
        };
      } catch {
        return { text: '获取今日资讯失败，请稍后再试 😅' };
      }
    }

    case 'hot-models': {
      try {
        const res = await fetch(`${base}/api/leaderboard?source=datalearner-comprehensive`);
        const json = await res.json();
        // API返回: { success, data: { rankings: [...], sourceLabel, metric, ... } }
        const rankings = json?.data?.rankings || json?.data?.entries || [];
        if (!Array.isArray(rankings) || rankings.length === 0) {
          return { text: '排行榜数据暂时为空 📊', link: '/leaderboard' };
        }
        const metric = json?.data?.metric || '分数';
        const lines = rankings
          .slice(0, 5)
          .map(
            (m: { modelName?: string; model_name?: string; name?: string; score?: number; developer?: string }, i: number) =>
              `${i + 1}. ${m.modelName || m.model_name || m.name || '未知'}${
                m.score ? ` (${m.score}${metric ? ' ' + metric : ''})` : ''
              }${m.developer && m.developer !== '未知' ? ` — ${m.developer}` : ''}`
          );
        return {
          text: `🏆 热门模型TOP5：\n${lines.join('\n')}`,
          link: '/leaderboard',
        };
      } catch {
        return { text: '获取排行榜失败，请稍后再试 😅' };
      }
    }

    case 'tools': {
      return {
        text: '🔧 AI工具推荐功能正在开发中，敬请期待！\n先去看看今日资讯吧 →',
        link: '/',
      };
    }

    case 'weekly': {
      return {
        text: '📋 每周深度摘要功能正在开发中，敬请期待！',
        link: '/daily',
      };
    }

    default:
      return { text: '' };
  }
}

/** 执行管理后台的操作（不走LLM） */
export async function executeAdminIntent(
  intent: AdminIntent
): Promise<TemplateResult> {
  switch (intent) {
    case 'sync-juya': {
      try {
        const res = await fetch('/api/admin/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'juya-check' }),
        });
        const data = await res.json();
        if (data.success) {
          return { text: `✅ 同步完成：${data.message || '资讯已更新'}` };
        }
        return { text: `❌ 同步失败：${data.error || data.message || '未知错误'}` };
      } catch {
        return { text: '❌ 同步请求失败，请检查网络' };
      }
    }

    case 'gen-daily': {
      try {
        const res = await fetch('/api/admin/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'daily' }),
        });
        const data = await res.json();
        if (data.success) {
          return { text: `✅ 日报已生成：${data.message || ''}` };
        }
        return { text: `❌ 日报生成失败：${data.error || data.message || '未知错误'}` };
      } catch {
        return { text: '❌ 日报生成请求失败' };
      }
    }

    case 'gen-weekly': {
      try {
        const res = await fetch('/api/admin/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'weekly' }),
        });
        const data = await res.json();
        if (data.success) {
          return { text: `✅ 周报已生成：${data.message || ''}` };
        }
        return { text: `❌ 周报生成失败：${data.error || data.message || '未知错误'}` };
      } catch {
        return { text: '❌ 周报生成请求失败' };
      }
    }

    case 'sync-leaderboard': {
      try {
        const res = await fetch('/api/admin/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'leaderboard' }),
        });
        const data = await res.json();
        if (data.success) {
          return { text: `✅ 排行榜已更新：${data.message || ''}` };
        }
        return { text: `❌ 排行榜更新失败：${data.error || data.message || '未知错误'}` };
      } catch {
        return { text: '❌ 排行榜更新请求失败' };
      }
    }

    case 'status': {
      try {
        const res = await fetch('/api/admin/status');
        const data = await res.json();
        if (!data) return { text: '❌ 无法获取系统状态' };

        const lines: string[] = [];
        lines.push(
          `📊 系统状态：\n` +
          `• Supabase：${data.supabaseOk ? '✅ 正常' : '❌ 异常'}\n` +
          `• 橘鸦RSS：${data.juyaRssOk ? '✅ 正常' : '❌ 异常'}\n` +
          `• 24h新闻：${data.newsCount24h}条\n` +
          `• 今日日报：${data.todayReport ? '✅ 已生成' : '❌ 未生成'}\n` +
          `• 排行榜：${data.leaderboardCount}条数据`
        );
        return { text: lines[0] };
      } catch {
        return { text: '❌ 获取系统状态失败' };
      }
    }

    case 'cleanup': {
      return {
        text: '⚠️ 数据清理功能正在开发中，请通过管理台手动操作',
      };
    }

    default:
      return { text: '' };
  }
}
