import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 分类标签映射
const CATEGORY_LABELS: Record<string, string> = {
  comprehensive: '综合',
  code: '编程',
  agent: 'Agent',
  overall: '整体',
  'aa-index': '性能指数',
};

// 开发者品牌色
const DEVELOPER_COLORS: Record<string, string> = {
  openai: '#10a37f',
  anthropic: '#d4a574',
  google: '#4285f4',
  deepseek: '#5b6ef7',
  meta: '#0084ff',
  '智谱AI': '#3b5cff',
};

interface ModelCard {
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
}

/**
 * GET /api/models
 * 获取模型卡片库列表
 *
 * 查询参数：
 * - search: 搜索关键词（模型名或开发者）
 * - sort: 排序方式 (bestScore | bestRank | name) 默认 bestScore
 * - limit: 返回数量（默认50）
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const search = searchParams.get('search') || '';
  const sort = searchParams.get('sort') || 'bestScore';
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);

  try {
    const client = getSupabaseClient();

    // 查询所有排行榜数据
    let query = client
      .from('model_leaderboard')
      .select('*')
      .order('score', { ascending: false, nullsFirst: false });

    if (search) {
      query = query.or(`model_name.ilike.%${search}%,developer.ilike.%${search}%`);
    }

    const { data, error } = await query.limit(limit * 5); // 多取一些，因为需要聚合

    if (error) throw new Error(`查询失败: ${error.message}`);
    if (!data || data.length === 0) {
      return NextResponse.json({ success: true, data: { models: [], total: 0 } });
    }

    // 按模型名聚合
    const modelMap = new Map<string, ModelCard>();
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
      const card = modelMap.get(key)!;

      // 更新最佳排名
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

    // 排序
    const models = Array.from(modelMap.values());
    switch (sort) {
      case 'bestRank':
        models.sort((a, b) => a.bestRank - b.bestRank);
        break;
      case 'name':
        models.sort((a, b) => a.modelName.localeCompare(b.modelName));
        break;
      case 'bestScore':
      default:
        models.sort((a, b) => b.bestScore - a.bestScore);
        break;
    }

    // 获取所有开发者列表（用于筛选）
    const developers = [...new Set(models.map((m) => m.developer))].sort();

    return NextResponse.json({
      success: true,
      data: {
        models: models.slice(0, limit),
        total: models.length,
        developers,
        categories: Object.entries(CATEGORY_LABELS).map(([key, label]) => ({ key, label })),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '获取模型列表失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}