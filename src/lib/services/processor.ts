import { chatJSON, chat } from "./ai-service";
import type { SearchResult } from "./search-service";
import type { FetchResult } from "./fetch-service";
import { NEWS_SOURCES, type SourcePriority } from "./search-service";
// NewsCategory is defined locally below (from NEWS_CATEGORIES)

// 信息源域名 → 优先级映射（用于加分）
const DOMAIN_PRIORITY_MAP = new Map<string, SourcePriority>();
for (const src of NEWS_SOURCES) {
  DOMAIN_PRIORITY_MAP.set(src.domain, src.priority);
}

/** 根据URL域名获取信息源优先级 */
function getSourcePriority(url: string): SourcePriority | null {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    for (const [domain, priority] of DOMAIN_PRIORITY_MAP) {
      if (hostname === domain || hostname.endsWith(`.${domain}`)) {
        return priority;
      }
    }
  } catch {
    // URL解析失败
  }
  return null;
}

/**
 * 对内容质量进行评级（0-10）
 * 用于过滤低质量/空泛内容
 */
export interface QualityAssessment {
  score: number;        // 0-10
  hasSubstance: boolean; // 是否有实质性信息
  reason: string;       // 评分理由
}

/** 根据信息源优先级对打分进行加分 */
function applySourceBoost(news: ProcessedNews[]): ProcessedNews[] {
  return news.map((n) => {
    const priority = getSourcePriority(n.sourceUrl);
    let boost = 0;
    switch (priority) {
      case "SSS": boost = 8; break;  // 顶级信源 +8
      case "SS":  boost = 5; break;  // 重要信源 +5
      case "S":   boost = 2; break;  // 一般信源 +2
      case "A":   boost = 0; break;  // 社区/学术不加分
      default:    boost = 0; break;  // 未知信源不加分
    }
    const boostedScore = n.importanceScore + boost;
    return {
      ...n,
      importanceScore: boostedScore,
      importanceLevel: boostedScore >= 35 ? "SSS" : boostedScore >= 25 ? "SS" : boostedScore >= 15 ? "S" : "A",
    };
  });
}

// 新闻分类体系（与前端 types.ts 保持一致）
export const NEWS_CATEGORIES = [
  "model",      // 大模型动态
  "opensource", // 开源项目
  "product",    // 产品发布
  "policy",     // 行业政策
  "research",   // 学术研究
  "agent",      // Agent
  "industry",   // 行业动态
] as const;

export type NewsCategory = (typeof NEWS_CATEGORIES)[number];

// AI 处理后的结构化新闻
export interface ProcessedNews {
  title: string;
  summary: string;
  sourceName: string;
  sourceUrl: string;
  category: NewsCategory;
  importanceScore: number;  // 8-40
  importanceLevel: string;  // SSS / SS / S / A
  keywords: string[];
  isAIRelated: boolean;
  publishedAt: string;
}

/**
 * 三层去重
 */
export function deduplicateResults(results: SearchResult[]): SearchResult[] {
  // 第一层：URL 去重
  const byUrl = new Map<string, SearchResult>();
  for (const r of results) {
    if (!r.url) continue;
    const normalizedUrl = r.url.replace(/\/$/, "").replace(/https?:\/\//, "");
    if (!byUrl.has(normalizedUrl)) {
      byUrl.set(normalizedUrl, r);
    }
  }

  const urlDeduped = Array.from(byUrl.values());

  // 第二层：标题相似度去重（简单实现 - 相同前缀30字符视为重复）
  const byTitle = new Map<string, SearchResult>();
  for (const r of urlDeduped) {
    if (!r.title) continue;
    const titleKey = r.title.toLowerCase().slice(0, 30);
    if (!byTitle.has(titleKey)) {
      byTitle.set(titleKey, r);
    }
  }

  return Array.from(byTitle.values());
}

/**
 * AI 批量处理：分类 + 打分 + 生成摘要 + 判断AI相关性 + 内容质量审核
 */
export async function processWithAI(
  results: SearchResult[],
  fetchedContents: Map<string, FetchResult>
): Promise<ProcessedNews[]> {
  if (results.length === 0) return [];

  // 分批处理，每批最多8条
  const batchSize = 8;
  const allProcessed: ProcessedNews[] = [];

  for (let i = 0; i < results.length; i += batchSize) {
    const batch = results.slice(i, i + batchSize);

    const itemsText = batch.map((r, idx) => {
      const content = fetchedContents.get(r.url);
      const bodyText = content?.success ? content.content.slice(0, 1500) : r.snippet;
      return `[${idx + 1}] 标题: ${r.title}\n摘要: ${bodyText}\n来源: ${r.source || "未知"}\nURL: ${r.url}`;
    }).join("\n\n");

    try {
      const processed = await chatJSON<ProcessedNews[]>(
        [
          {
            role: "system",
            content: `你是一个AI新闻分析师。请对以下新闻条目进行全面分析，为每条新闻：

1. 判断是否与AI（人工智能）直接相关。只有与AI大模型、AI应用、AI工具、AI研究、AI行业直接相关的才标记为true
2. 生成50-100字的中文摘要，聚焦核心事实和关键数据
3. 分类到以下类别之一: model(大模型动态), opensource(开源项目), product(产品发布), policy(行业政策), research(学术研究), agent(Agent), industry(行业动态)
4. 从四个维度打分(1-10): 影响力(影响范围)、时效性(是否刚发生)、独特性(是否独家/首次)、可靠性(信源可信度)
5. 提取3-5个关键词
6. **内容质量审核**：判断该新闻是否有实质性信息（包含具体数据、事件描述、产品细节等），还是空泛的标题党/概览性内容。只有包含实质性信息的才标记 qualityScore >= 5

返回JSON数组，每个元素格式:
{
  "title": "原标题",
  "summary": "中文摘要50-100字",
  "sourceName": "来源名称",
  "sourceUrl": "原URL",
  "category": "model|opensource|product|policy|research|agent|industry",
  "importanceScore": 总分(4个维度之和,4-40),
  "importanceLevel": "SSS(≥35)|SS(25-34)|S(15-24)|A(8-14)",
  "keywords": ["关键词1", "关键词2"],
  "isAIRelated": true/false,
  "publishedAt": "YYYY-MM-DD",
  "content": "" (留空，由系统填充)
}

注意：与AI无关的新闻设isAIRelated=false，这些将被过滤掉。
注意：摘要必须包含具体信息，不要使用"近日"、"最近"等模糊词汇。`,
          },
          {
            role: "user",
            content: itemsText,
          },
        ],
        { temperature: 0.1, maxTokens: 4000 }
      );

      allProcessed.push(...processed);
    } catch (e) {
      console.error(`AI processing batch ${i / batchSize + 1} failed:`, e);
      // 降级：用基础数据填充
      for (const r of batch) {
        allProcessed.push({
          title: r.title,
          summary: r.snippet,
          sourceName: r.source || "未知",
          sourceUrl: r.url,
          category: "product" as NewsCategory,
          importanceScore: 15,
          importanceLevel: "S",
          keywords: [],
          isAIRelated: true,
          publishedAt: new Date().toISOString().split("T")[0],
        });
      }
    }
  }

  return allProcessed;
}

/**
 * 内容质量审核：检查摘要是否包含实质性信息
 * 过滤空泛的标题党、摘要过短、无具体信息的内容
 */
function contentQualityCheck(news: ProcessedNews[]): ProcessedNews[] {
  return news.filter((n) => {
    const summary = n.summary?.trim() || "";

    // 1. 摘要太短（<10字）说明无实质内容
    if (summary.length < 10) return false;

    // 2. 摘要中包含"暂无"、"无相关"等空值标记
    if (/暂无|无相关|未提供|无内容|暂无数据/i.test(summary)) return false;

    // 3. 标题中不包含实质性关键词（纯广告/抽奖/活动类）
    const title = n.title?.trim() || "";
    const spamPatterns = /抽奖|红包|免费领取|点击领取|限时秒杀|注册送/i;
    if (spamPatterns.test(title)) return false;

    return true;
  });
}

/**
 * 过滤非AI相关和低质量内容
 * 多阶段过滤：AI相关性 → 内容质量 → 分数阈值 → 源加分 → 排序
 */
export function filterNews(news: ProcessedNews[]): ProcessedNews[] {
  if (news.length === 0) return [];

  // 阶段1: 仅保留AI相关
  let filtered = news.filter((n) => n.isAIRelated);

  console.log(
    `[Filter] After AI relevancy filter: ${filtered.length}/${news.length}`
  );

  // 阶段2: 内容质量审核
  filtered = contentQualityCheck(filtered);

  console.log(
    `[Filter] After quality check: ${filtered.length}/${news.length}`
  );

  // 阶段3: 应用信息源加分
  const boosted = applySourceBoost(filtered);

  // 阶段4: 过滤低分（<8分即为B级）
  const scored = boosted.filter((n) => n.importanceScore >= 8);

  console.log(
    `[Filter] After score threshold: ${scored.length}/${boosted.length}`
  );

  // 阶段5: 按分数降序排列
  return scored.sort((a, b) => b.importanceScore - a.importanceScore);
}

/**
 * 生成日报完整文章
 * 产出是一篇由资讯拼接而成的完整文章，包含标题、导语、分章节详述、结语
 */
export async function generateDailyArticle(news: ProcessedNews[]): Promise<string> {
  // 按重要性排序，取前10条核心资讯
  const topNews = news.slice(0, 10);
  const newsText = topNews.map((n, i) => `${i + 1}. [${n.category}] ${n.title}\n   摘要：${n.summary}\n   来源：${n.sourceName}`).join("\n\n");

  if (!newsText.trim()) {
    return "今日暂无重大AI动态。";
  }

  const article = await chat(
    [
      {
        role: "system",
        content: `你是一位资深AI行业编辑，正在为「AI Pulse」撰写每日深度文章。

要求：
1. 生成一篇完整的中文文章，800-1500字
2. 结构为：主标题 → 导语（1段，概括今日核心动态）→ 分章节详述（2-4个章节，每章围绕一个主题展开，融入相关资讯细节和分析）→ 结语（1段，点明趋势或展望）
3. 每个章节内要自然地引用和衔接提供的资讯条目，不是简单罗列，而是形成有逻辑的叙述
4. 语气专业、克制，像财经媒体的深度报道，不要过度渲染
5. 使用 Markdown 格式：主标题用 ##，章节标题用 ###，关键信息可加粗
6. 不要在文章中列举编号列表，而是用段落式叙述
7. 不要使用"让我们"这类口语化表达`,
      },
      {
        role: "user",
        content: `以下是今日AI领域的重要资讯，请据此撰写一篇完整的日报文章：\n\n${newsText}`,
      },
    ],
    { temperature: 0.4, maxTokens: 4096 }
  );

  return article;
}

/**
 * @deprecated 使用 generateDailyArticle 替代
 */
export async function generateDailyOverview(news: ProcessedNews[]): Promise<string> {
  return generateDailyArticle(news);
}

/**
 * 生成周报概览
 */
export async function generateWeeklyOverview(news: ProcessedNews[]): Promise<string> {
  // 优先取 SSS/SS 级，不足时取 top 8 高分
  let topNews = news.filter((n) => n.importanceLevel === "SSS" || n.importanceLevel === "SS").slice(0, 8);
  if (topNews.length < 5) {
    topNews = news.slice(0, 8);
  }
  const newsText = topNews.map((n) => `- [${n.category}] ${n.title}: ${n.summary}`).join("\n");

  if (!newsText.trim()) {
    return "本周暂无重大AI动态。";
  }

  const overview = await chat(
    [
      {
        role: "system",
        content: "你是一个AI行业分析师。请根据以下本周重要AI新闻，生成一段3-4句话的中文概览，概括本周AI领域的核心动态和趋势。语气专业，注重洞察。",
      },
      {
        role: "user",
        content: newsText,
      },
    ],
    { temperature: 0.3, maxTokens: 400 }
  );

  return overview;
}

/**
 * 生成周报趋势洞察
 */
export async function generateWeeklyTrends(news: ProcessedNews[]): Promise<{
  techTrends: string;
  industryTrends: string;
  investmentHighlights: string;
}> {
  const categorized = {
    tech: news.filter((n) => ["model", "opensource", "research", "agent"].includes(n.category)),
    industry: news.filter((n) => ["product", "policy"].includes(n.category)),
    all: news,
  };

  const [techTrends, industryTrends, investmentHighlights] = await Promise.all([
    chat(
      [
        {
          role: "system",
          content: "分析以下本周AI技术和研究领域的新闻，用2-3句话总结本周技术趋势，聚焦模型架构、训练方法、开源生态等方向的趋势变化。",
        },
        {
          role: "user",
          content: categorized.tech.map((n) => `- ${n.title}: ${n.summary}`).join("\n"),
        },
      ],
      { temperature: 0.3, maxTokens: 300 }
    ),
    chat(
      [
        {
          role: "system",
          content: "分析以下本周AI行业和产品领域的新闻，用2-3句话总结本周行业动态趋势，聚焦产品方向、市场格局、政策变化等。",
        },
        {
          role: "user",
          content: categorized.industry.map((n) => `- ${n.title}: ${n.summary}`).join("\n"),
        },
      ],
      { temperature: 0.3, maxTokens: 300 }
    ),
    chat(
      [
        {
          role: "system",
          content: "基于以下本周AI新闻，用2-3句话总结本周值得关注的投资和商业机会，包括新赛道、未被满足的需求、正在升温的方向等。",
        },
        {
          role: "user",
          content: categorized.all.slice(0, 10).map((n) => `- ${n.title}: ${n.summary}`).join("\n"),
        },
      ],
      { temperature: 0.3, maxTokens: 300 }
    ),
  ]);

  return { techTrends, industryTrends, investmentHighlights };
}

/**
 * 提取热门关键词
 */
export function extractHotTopics(news: ProcessedNews[]): string[] {
  const keywordCount = new Map<string, number>();

  for (const n of news) {
    for (const kw of n.keywords) {
      keywordCount.set(kw, (keywordCount.get(kw) || 0) + 1);
    }
  }

  return Array.from(keywordCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([kw]) => kw);
}
