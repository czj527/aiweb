import { getSupabaseClient } from '@/storage/database/supabase-client';
import { ModelsClient } from '@/components/models-client';

export const revalidate = 60;

export default async function ModelsPage() {
  // SSR预取数据
  let initialModels: Array<{
    modelName: string;
    developer: string;
    parameters: string;
    description: string;
    bestRank: number;
    bestScore: number;
    bestCategory: string;
    scores: Array<{
      source: string;
      category: string;
      categoryLabel: string;
      score: number;
      rankPosition: number;
      rankChange: number;
    }>;
    color: string;
  }> = [];
  let developers: string[] = [];
  let categories: Array<{ key: string; label: string }> = [];

  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('model_leaderboard')
      .select('*')
      .order('score', { ascending: false, nullsFirst: false })
      .limit(200);

    if (!error && data && data.length > 0) {
      const CATEGORY_LABELS: Record<string, string> = {
        comprehensive: '综合',
        code: '编程',
        agent: 'Agent',
        overall: '整体',
        'aa-index': '性能指数',
      };
      const DEVELOPER_COLORS: Record<string, string> = {
        openai: '#10a37f',
        anthropic: '#d4a574',
        google: '#4285f4',
        deepseek: '#5b6ef7',
        meta: '#0084ff',
        '智谱ai': '#3b5cff',
      };

      const modelMap = new Map();
      for (const row of data) {
        const key = row.model_name;
        if (!modelMap.has(key)) {
          modelMap.set(key, {
            modelName: row.model_name,
            developer: row.developer || '未知',
            parameters: row.parameters || '未知',
            description: row.description || '',
            bestRank: row.rank_position || 999,
            bestScore: row.score || 0,
            bestCategory: row.category || '',
            scores: [],
            color: DEVELOPER_COLORS[(row.developer || '').toLowerCase()] || '#6366f1',
          });
        }
        const card = modelMap.get(key);
        if ((row.rank_position || 999) < card.bestRank) {
          card.bestRank = row.rank_position;
          card.bestCategory = row.category;
        }
        if ((row.score || 0) > card.bestScore) {
          card.bestScore = row.score;
        }
        card.scores.push({
          source: row.source,
          category: row.category,
          categoryLabel: CATEGORY_LABELS[row.category] || row.category,
          score: row.score || 0,
          rankPosition: row.rank_position || 0,
          rankChange: row.rank_change || 0,
        });
      }

      const sorted = Array.from(modelMap.values());
      sorted.sort((a: { bestScore: number }, b: { bestScore: number }) => b.bestScore - a.bestScore);
      initialModels = sorted;
      developers = [...new Set(sorted.map((m: { developer: string }) => m.developer))].sort();
      categories = Object.entries(CATEGORY_LABELS).map(([key, label]) => ({ key, label }));
    }
  } catch (e) {
    console.error('[models] SSR failed:', e);
  }

  return <ModelsClient initialModels={initialModels} developers={developers} categories={categories} />;
}
