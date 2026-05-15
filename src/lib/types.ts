// 新闻分类
export type NewsCategory = 'model' | 'opensource' | 'product' | 'policy' | 'research' | 'agent' | 'industry';

export const categoryConfig: Record<NewsCategory, { label: string; icon: string }> = {
  model: { label: '大模型动态', icon: 'brain' },
  opensource: { label: '开源项目', icon: 'git-branch' },
  product: { label: '产品发布', icon: 'rocket' },
  policy: { label: '行业政策', icon: 'landmark' },
  research: { label: '学术研究', icon: 'graduation-cap' },
  agent: { label: 'Agent', icon: 'bot' },
  industry: { label: '行业动态', icon: 'building' },
};

// 新闻条目
export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  publishedAt: string;
  category: NewsCategory;
  // 详情页用
  content?: string;
  tags?: string[];
  readingTime?: string;
  multiSources?: { name: string; title: string; summary: string; url?: string }[];
  relatedIds?: string[];
}

// 日报数据
export interface DailyReport {
  date: string;
  displayDate: string;
  overview: string;
  news: NewsItem[];
}

// 周报数据
export interface WeeklyReport {
  weekNumber: number;
  weekRange: string;
  overview: string;
  trends: string[];
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

// 排行榜维度（兼容旧代码）
export type LeaderboardDimension = 'overall' | 'code' | 'reasoning' | 'chinese' | 'multimodal' | 'hard';

export const dimensionLabels: Record<string, string> = {
  overall: '综合排名',
  code: '代码能力',
  reasoning: '推理能力',
  chinese: '中文能力',
  hard: '高难度',
  multimodal: '多模态',
};
