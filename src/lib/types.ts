// 新闻分类（对齐橘鸦AI早报的8分类体系）
export type NewsCategory = '要闻' | '模型发布' | '开发生态' | '产品应用' | '技术与洞察' | '行业动态' | '政策与治理' | '前瞻与传闻';

export const categoryConfig: Record<NewsCategory, { label: string; icon: string }> = {
  '要闻': { label: '要闻', icon: 'star' },
  '模型发布': { label: '模型发布', icon: 'brain' },
  '开发生态': { label: '开发生态', icon: 'git-branch' },
  '产品应用': { label: '产品应用', icon: 'rocket' },
  '技术与洞察': { label: '技术与洞察', icon: 'graduation-cap' },
  '行业动态': { label: '行业动态', icon: 'building' },
  '政策与治理': { label: '政策与治理', icon: 'landmark' },
  '前瞻与传闻': { label: '前瞻与传闻', icon: 'eye' },
};

// 橘鸦8分类常量（用于下拉选择等场景）
export const JUYU_CATEGORIES: NewsCategory[] = [
  '要闻',
  '模型发布',
  '开发生态',
  '产品应用',
  '技术与洞察',
  '行业动态',
  '政策与治理',
  '前瞻与传闻',
];

// 新闻条目
export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  publishedAt: string;
  category: NewsCategory;
  tags?: string[];
  relatedIds?: string[];
}

// 日报数据
export interface DailyReport {
  date: string;
  displayDate: string;
  overview: string;
  news: NewsItem[];
}

// 排行榜模型
export interface ModelRanking {
  rank: number;
  name: string;
  developer: string;
  params: string;
  score: number;
  change: number;
}
