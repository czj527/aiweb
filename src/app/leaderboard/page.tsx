'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowUp, ArrowDown, Minus, RefreshCw, ExternalLink, Trophy, Loader2 } from 'lucide-react';

interface LeaderboardEntry {
  id: string;
  modelName: string;
  developer: string;
  score: number;
  rankPosition: number;
  rankChange: number;
  description: string;
}

interface LeaderboardResponse {
  source: string;
  category: string;
  rankings: LeaderboardEntry[];
  fetchedAt: string;
  sourceUrl: string;
}

const TABS = [
  { key: 'datalearner-comprehensive', label: '综合排行榜', metric: 'HLE 分数', url: 'https://www.datalearner.com/leaderboards' },
  { key: 'datalearner-code', label: '编程能力', metric: 'SWE-bench 分数', url: 'https://www.datalearner.com/leaderboards' },
  { key: 'datalearner-agent', label: 'Agent能力', metric: 'τ²-Bench 分数', url: 'https://www.datalearner.com/leaderboards' },
] as const;

type TabKey = typeof TABS[number]['key'];

async function fetchLeaderboard(key: TabKey): Promise<LeaderboardResponse> {
  const res = await fetch(`/api/leaderboard?source=${key}`);
  if (!res.ok) throw new Error('Failed to fetch leaderboard');
  const json = await res.json();
  // API returns { success, data: {...} }
  return json.data || json;
}

function RankChange({ change }: { change: number }) {
  if (change > 0) return <span className="inline-flex items-center text-emerald-600 text-xs font-medium"><ArrowUp className="w-3 h-3 mr-0.5" />{change}</span>;
  if (change < 0) return <span className="inline-flex items-center text-red-500 text-xs font-medium"><ArrowDown className="w-3 h-3 mr-0.5" />{Math.abs(change)}</span>;
  return <span className="inline-flex items-center text-muted-foreground text-xs"><Minus className="w-3 h-3" /></span>;
}

export default function LeaderboardPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('datalearner-comprehensive');
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (tabKey: TabKey) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchLeaderboard(tabKey);
      setData(result);
    } catch {
      setError('无法加载排行榜数据');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(activeTab);
  }, [activeTab, loadData]);

  const activeTabConfig = TABS.find(t => t.key === activeTab)!;

  const getScorePercent = (score: number, entries: LeaderboardEntry[]) => {
    if (!entries.length) return 0;
    const maxScore = Math.max(...entries.map(e => e.score));
    const minScore = Math.min(...entries.map(e => e.score));
    if (maxScore === minScore) return 100;
    return ((score - minScore) / (maxScore - minScore)) * 100;
  };

  return (
    <main className="max-w-6xl mx-auto px-6 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Trophy className="w-7 h-7 text-primary" />
          <h1 className="text-3xl font-bold text-foreground tracking-tight">大模型排行榜</h1>
        </div>
        <p className="text-muted-foreground text-sm ml-10">
          数据来源于 <a href="https://www.datalearner.com/leaderboards" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">DataLearner<ExternalLink className="w-3 h-3" /></a>，聚合主流评测基准的实时排名
        </p>
      </div>

      <div className="border-b border-border mb-6 overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {TABS.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'}`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {data && (
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-4 px-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 bg-muted px-2 py-0.5 rounded-md font-medium text-foreground">{activeTabConfig.metric}</span>
            <span>共 {data.rankings.length} 个模型</span>
            {data.fetchedAt && <span>· 更新于 {new Date(data.fetchedAt).toLocaleDateString('zh-CN')}</span>}
          </div>
          <a href={data.sourceUrl || activeTabConfig.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
            查看原始排行 <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
          <span className="text-muted-foreground">加载排行榜数据...</span>
        </div>
      )}

      {error && !loading && (
        <div className="text-center py-20">
          <p className="text-muted-foreground mb-4">{error}</p>
          <button onClick={() => loadData(activeTab)} className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 text-sm">
            <RefreshCw className="w-4 h-4" /> 重试
          </button>
        </div>
      )}

      {data && !loading && !error && data.rankings.length > 0 && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-16">排名</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">模型</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-28">开发者</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-20">分数</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-32">分数分布</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-16">变化</th>
                </tr>
              </thead>
              <tbody>
                {data.rankings.map((entry) => {
                  const percent = getScorePercent(entry.score, data.rankings);
                  const isTop3 = entry.rankPosition <= 3;
                  const rankBadgeColors = ['bg-amber-500 text-white', 'bg-slate-400 text-white', 'bg-amber-700 text-white'];
                  return (
                    <tr key={entry.id} className={`border-b border-border last:border-b-0 transition-colors hover:bg-muted/20 ${isTop3 ? 'bg-primary/5' : ''}`}>
                      <td className="py-3 px-4">
                        {isTop3 ? (
                          <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${rankBadgeColors[entry.rankPosition - 1]}`}>{entry.rankPosition}</span>
                        ) : (
                          <span className="text-muted-foreground text-sm font-medium pl-2">{entry.rankPosition}</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <span className={`font-semibold text-sm ${isTop3 ? 'text-foreground' : 'text-foreground/90'}`}>{entry.modelName}</span>
                          {entry.description && <p className="text-xs text-muted-foreground mt-0.5">{entry.description}</p>}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">{entry.developer || '—'}</td>
                      <td className="py-3 px-4"><span className={`font-bold text-sm ${isTop3 ? 'text-primary' : 'text-foreground'}`}>{entry.score}</span></td>
                      <td className="py-3 px-4">
                        <div className="w-full bg-muted rounded-full h-2">
                          <div className={`h-2 rounded-full transition-all duration-500 ${isTop3 ? 'bg-primary' : 'bg-primary/40'}`} style={{ width: `${Math.max(percent, 3)}%` }} />
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center"><RankChange change={entry.rankChange} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data && !loading && !error && data.rankings.length === 0 && (
        <div className="text-center py-20">
          <Trophy className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground">暂无排行榜数据</p>
        </div>
      )}

      <div className="mt-8 px-1">
        <div className="bg-muted/30 rounded-lg p-4 text-xs text-muted-foreground space-y-1.5">
          <p>排行榜数据来源于第三方评测平台，仅供参考。</p>
          <p>AA 智能指数汇总编程、数学、推理等10项标准化评测；LMArena 基于全球用户匿名盲测 A/B 投票。</p>
        </div>
      </div>
    </main>
  );
}
