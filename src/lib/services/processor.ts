import { chatJSON, chat } from "./ai-service";
import type { SearchResult } from "./search-service";
import type { FetchResult } from "./fetch-service";
import { NEWS_SOURCES, type SourcePriority } from "./search-service";
import { getRecentNews } from "./db-service";
// NewsCategory is defined locally below (from NEWS_CATEGORIES)

/**
 * 72小时数据库去重：与数据库中已有的近期新闻比对
 * 标题相似度 > 0.6 或 URL完全匹配 即视为重复
 */
export async function dedupAgainstDatabase(
  results: SearchResult[],
  hours: number = 72
): Promise<SearchResult[]> {
  try {
    const recentNews = await getRecentNews(hours, 200);
    if (recentNews.length === 0) return results;

    const existingUrls = new Set(
      recentNews.map((n) => normalizeUrl(n.source_url)).filter(Boolean)
    );
    const existingTitles = recentNews.map((n) => n.title?.toLowerCase() || "");

    const fresh: SearchResult[] = [];
    let dupCount = 0;

    for (const r of results) {
      const normalizedUrl = normalizeUrl(r.url);

      // URL完全匹配 → 重复
      if (existingUrls.has(normalizedUrl)) {
        dupCount++;
        continue;
      }

      // 标题相似度 > 0.6 → 重复
      const isTitleDup = existingTitles.some(
        (existingTitle) => titleSimilarity(existingTitle, r.title) > 0.6
      );
      if (isTitleDup) {
        dupCount++;
        continue;
      }

      fresh.push(r);
    }

    console.log(
      `[Dedup72h] Filtered ${dupCount} duplicates, ${fresh.length} remaining (from ${results.length})`
    );
    return fresh;
  } catch (e) {
    console.warn("[Dedup72h] Database dedup failed, skipping:", e);
    return results;
  }
}

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


/** URL标准化：去除追踪参数，统一格式 */
function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    const paramsToRemove = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'ref', 'spm', 'from', 'isappinstalled', 'nsukey', 'share_token'];
    paramsToRemove.forEach(p => u.searchParams.delete(p));
    u.pathname = u.pathname.replace(/\/+$/, '');
    return u.toString().toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

/** 标题词频相似度（Jaccard系数） */
function titleSimilarity(a: string, b: string): number {
  const wordsA = a.toLowerCase().split(/\s+/);
  const wordsB = b.toLowerCase().split(/\s+/);
  const setA = new Set(wordsA);
  const setB = new Set(wordsB);
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

/** 判断新闻是否在24小时内 */
function isWithin24Hours(publishedAt: string): boolean {
  if (!publishedAt) return true; // 无日期的保留，由AI后续判断
  const pubDate = new Date(publishedAt);
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return pubDate >= cutoff;
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


/** 主题加分：模型发布/Agent/OpenClaw/模型价格 权重更高 */
function applyTopicBoost(news: ProcessedNews[]): ProcessedNews[] {
  return news.map(n => {
    let boost = 0;
    // 模型发布和Agent分类加分
    if (n.category === 'model' || n.category === 'agent') boost += 5;
    // MCP/RAG相关加分
    const text = `${n.title} ${n.summary}`.toLowerCase();
    if (text.includes('mcp') || text.includes('rag') || text.includes('retrieval augmented')) boost += 5;
    // 模型价格相关加分
    if (/价格|定价|免费|pricing|price|free tier|api cost|token price|计费/i.test(text)) boost += 3;
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
  quote: string;           // 引用原文（1-2句核心事实，blockquote格式）
  sourceName: string;
  sourceUrl: string;
  category: NewsCategory;
  importanceScore: number;  // 8-40
  importanceLevel: string;  // SSS / SS / S / A
  keywords: string[];
  isAIRelated: boolean;
  publishedAt: string;
  isBreaking: boolean;     // 是否为当日要闻（最重要的1-3条）
}

/**
 * 三层去重
 */
export function deduplicateResults(results: SearchResult[]): SearchResult[] {
  // 第一层：URL 去重（改进的URL标准化）
  const byUrl = new Map<string, SearchResult>();
  for (const r of results) {
    if (!r.url) continue;
    const normalizedUrl = normalizeUrl(r.url);
    if (!byUrl.has(normalizedUrl)) {
      byUrl.set(normalizedUrl, r);
    }
  }

  const urlDeduped = Array.from(byUrl.values());

  // 第二层：标题语义相似度去重（Jaccard词频重叠度 > 0.7视为重复）
  const kept: SearchResult[] = [];
  for (const r of urlDeduped) {
    if (!r.title) continue;
    const isDuplicate = kept.some(existing => titleSimilarity(existing.title, r.title) > 0.7);
    if (!isDuplicate) {
      kept.push(r);
    }
  }

  return kept;
}

/**
 * AI 批量处理：分类 + 打分 + 生成详细内容 + 判断AI相关性 + 内容质量审核
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
            content: `你是一位资深AI行业新闻分析师，正在为「AI Pulse」AI资讯日报筛选和处理新闻。

你的任务是对每条新闻进行深度分析，生成高质量的内容。请严格按以下标准执行：

=== 1. AI相关性判断 ===
只有与以下内容直接相关的才标记 isAIRelated=true：
- AI大模型（GPT、Claude、Gemini、DeepSeek、Qwen、Llama等）的发布、更新、价格变化
- AI应用/产品（ChatGPT、Copilot、Midjourney等）的新功能或重大更新
- AI工具/框架（LangChain、LlamaIndex、vLLM等）的发布或更新
- AI公司融资、收购、战略合作
- AI政策法规（各国AI监管、标准制定）
- AI学术突破（新架构、新训练方法、SOTA结果）
- AI Agent、RAG、多模态等技术方向的重要进展
以下不算AI相关：通用云计算、区块链、普通软件更新、非AI的硬件产品

=== 2. 内容生成（最重要） ===
摘要（summary）：200-400字的完整新闻正文，不是简单概括。要求：
- 第一段：核心事实（谁、做了什么、什么时候）
- 第二段：技术细节或背景分析（为什么重要、技术原理、市场影响）
- 第三段（可选）：影响评估或后续展望
- 包含具体数据（版本号、参数量、价格、融资金额等）
- 使用专业但易懂的语言，面向AI从业者
- 不要使用"近日"、"最近"等模糊时间词，用具体日期

引用（quote）：从原文中提取1-2句最关键的事实陈述，用引号格式。这是直接引用，不是你总结的。
例如："GPT-5 will support 1M context window and native multimodal input."

=== 3. 分类 ===
model: 大模型发布/更新/评测（GPT-5、Claude 4、Gemini 2、Qwen3等）
opensource: 开源模型/工具/框架发布
product: AI产品/应用发布或重大更新
policy: AI政策、法规、行业标准
research: 学术论文、技术突破
agent: AI Agent框架/产品/进展
industry: 公司融资、收购、市场动态

=== 4. 评分体系（四维度，各1-10分） ===
影响力（impact）：影响范围和深度
  - 10: 改变行业格局（如GPT-5发布、重大收购）
  - 7-9: 重要产品发布/更新、大额融资
  - 4-6: 一般产品更新、技术博客
  - 1-3: 小众工具、个人观点
时效性（timeliness）：是否为最新消息
  - 10: 今天刚发布
  - 7-9: 1-2天内
  - 4-6: 3-7天内
  - 1-3: 超过一周
独特性（uniqueness）：是否为独家/首次报道
  - 10: 官方首次发布
  - 7-9: 独家报道/深度分析
  - 4-6: 多家媒体报道的同一事件
  - 1-3: 转载/二手信息
可靠性（reliability）：信源可信度
  - 10: 官方博客/官方公告
  - 7-9: 知名科技媒体
  - 4-6: 一般媒体/社区
  - 1-3: 个人博客/未验证消息

importanceScore = 四个维度之和（4-40）
importanceLevel: >=35 SSS, >=25 SS, >=15 S, <15 A

=== 5. 要闻标记（isBreaking） ===
只有最重要的1-3条新闻标记 isBreaking=true。标准：
- 重大模型发布（新旗舰模型）
- 重大融资（>1亿美元）
- 重大政策变化
- 行业格局变化（收购、合并）

=== 6. 关键词 ===
提取3-5个关键词，用于归类和搜索。优先使用：模型名称、公司名、技术术语。

=== 7. 内容质量审核 ===
以下情况应被低分或过滤：
- 内容空泛，没有具体数据或事件
- 纯粹的广告/推广/招聘信息
- 过时的新闻（超过7天）
- 无法验证的传闻（除非标记为传闻）

返回JSON数组，每个元素格式:
{
  "title": "原标题",
  "summary": "详细正文200-400字",
  "quote": "引用原文1-2句核心事实",
  "sourceName": "来源名称",
  "sourceUrl": "原URL",
  "category": "model|opensource|product|policy|research|agent|industry",
  "importanceScore": 总分(4-40),
  "importanceLevel": "SSS|SS|S|A",
  "keywords": ["关键词1", "关键词2"],
  "isAIRelated": true/false,
  "isBreaking": true/false,
  "publishedAt": "YYYY-MM-DD"
}

注意：与AI无关的新闻设isAIRelated=false，这些将被过滤掉。
注意：摘要必须是完整的新闻正文，不是一句话概括。`,
          },
          {
            role: "user",
            content: itemsText,
          },
        ],
        { temperature: 0.1, maxTokens: 12000 }
      );

      allProcessed.push(...processed);
    } catch (e) {
      console.error(`AI processing batch ${i / batchSize + 1} failed:`, e);
      // 降级：用基础数据填充
      for (const r of batch) {
        allProcessed.push({
          title: r.title,
          summary: r.snippet,
          quote: "",
          sourceName: r.source || "未知",
          sourceUrl: r.url,
          category: "product" as NewsCategory,
          importanceScore: 15,
          importanceLevel: "S",
          keywords: [],
          isAIRelated: true,
          publishedAt: new Date().toISOString().split("T")[0],
          isBreaking: false,
        });
      }
    }
  }

  return allProcessed;
}

/**
 * 内容质量审核：多维度质量评估
 * 过滤空泛标题党、摘要过短、无具体信息、模板化内容
 */
function contentQualityCheck(news: ProcessedNews[]): ProcessedNews[] {
  return news.filter((n) => {
    const summary = n.summary?.trim() || "";
    const title = n.title?.trim() || "";

    // 1. 摘要太短（<50字）说明无实质内容
    if (summary.length < 50) return false;

    // 2. 空值标记
    if (/暂无|无相关|未提供|无内容|暂无数据|no data|not available/i.test(summary)) return false;

    // 3. 垃圾内容过滤（广告/抽奖/招聘/推广）
    const spamPatterns = /抽奖|红包|免费领取|点击领取|限时秒杀|注册送|招聘|求职|加盟|代理|赌博|代写|刷单/i;
    if (spamPatterns.test(title) || spamPatterns.test(summary)) return false;

    // 4. 纯观点/评论类（没有具体事件）
    const opinionOnly = /^(我觉得|我认为|个人看法|浅谈|杂谈|随笔)/;
    if (opinionOnly.test(title)) return false;

    // 5. 摘要中必须包含至少一个具体数据或实体名称
    const hasSubstance = /\d|[A-Z][a-z]+\s?\d|GPT|Claude|Gemini|DeepSeek|Qwen|Llama|OpenAI|Google|Microsoft|Meta|Anthropic|融资|发布|更新|开源/i;
    if (!hasSubstance.test(summary)) return false;

    // 6. 标题-摘要重叠度过高检测（摘要只是标题的扩写，没有新信息）
    if (title.length > 10 && summary.length < 200) {
      const titleChars = new Set(title.toLowerCase().split(""));
      const summaryChars = summary.toLowerCase().split("");
      const overlap = summaryChars.filter(c => titleChars.has(c)).length;
      const charOverlapRatio = summaryChars.length > 0 ? overlap / summaryChars.length : 0;
      if (charOverlapRatio > 0.85) return false;
    }

    // 7. 纯英文内容如果太短（<80字符），可能只是RSS的description片段
    if (!/[\u4e00-\u9fff]/.test(summary) && summary.length < 80) return false;

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

  // 阶段2.5: 24小时时效性过滤
  filtered = filtered.filter(n => isWithin24Hours(n.publishedAt));
  console.log(`[Filter] After 24h recency filter: ${filtered.length}/${news.length}`);

  // 阶段3: 应用信息源加分
  const sourceBoosted = applySourceBoost(filtered);

  // 阶段3.5: 应用主题加分（模型发布/Agent/OpenClaw/模型价格 权重更高）
  const boosted = applyTopicBoost(sourceBoosted);

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
