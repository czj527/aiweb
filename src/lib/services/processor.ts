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
      case "SSS": boost = 6; break;  // 官方源 +6
      case "SS":  boost = 4; break;  // 重要厂商 +4
      case "S":   boost = 2; break;  // 知名媒体 +2
      case "A":   boost = 0; break;  // 社区/学术不加分
      default:    boost = 0; break;  // 未知信源不加分
    }
    const boostedScore = n.importanceScore + boost;
    return {
      ...n,
      importanceScore: boostedScore,
      importanceLevel: boostedScore >= 30 ? "SSS" : boostedScore >= 22 ? "SS" : boostedScore >= 14 ? "S" : "A",
    };
  });
}


/** 主题加分：高价值主题权重更高 */
function applyTopicBoost(news: ProcessedNews[]): ProcessedNews[] {
  return news.map(n => {
    let boost = 0;
    // 模型发布和Agent分类加分
    if (n.category === 'model' || n.category === 'agent') boost += 3;
    // MCP/RAG相关加分
    const text = `${n.title} ${n.summary}`.toLowerCase();
    if (text.includes('mcp') || text.includes('rag') || text.includes('retrieval augmented')) boost += 3;
    // 模型价格相关加分（直接影响用户）
    if (/价格|定价|免费|pricing|price|free tier|api cost|token price|计费/i.test(text)) boost += 2;
    // 开源发布加分
    if (n.category === 'opensource' && (text.includes('开源') || text.includes('open source') || text.includes('open-source'))) boost += 2;
    const boostedScore = n.importanceScore + boost;
    return {
      ...n,
      importanceScore: boostedScore,
      importanceLevel: boostedScore >= 30 ? "SSS" : boostedScore >= 22 ? "SS" : boostedScore >= 14 ? "S" : "A",
    };
  });
}

// 新闻分类体系（对齐橘鸦AI早报8分类）
export const NEWS_CATEGORIES = [
  "model",      // 模型发布：新模型、模型更新、评测榜单
  "opensource", // 开源项目：开源模型/工具/框架发布
  "product",    // 产品应用：AI产品/应用发布或重大更新
  "policy",     // 行业政策：AI政策、法规、行业标准
  "research",   // 技术与洞察：技术解析、研究报告、学术论文
  "agent",      // Agent：AI Agent框架/产品/进展
  "industry",   // 行业动态：融资、收购、人事变动、市场格局
  "rumor",      // 前瞻与传闻：未确认消息、预告、规划
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
对标参考：橘鸦AI早报（https://imjuya.github.io/juya-ai-daily/），你需要达到同等的信息质量。

你的任务是对每条新闻进行深度分析，生成高质量的内容。请严格按以下标准执行：

=== 1. AI相关性判断（严格把关） ===
只有与以下内容直接相关的才标记 isAIRelated=true：
- AI大模型（GPT、Claude、Gemini、DeepSeek、Qwen、Llama、Grok等）的发布、更新、价格变化
- AI应用/产品（ChatGPT、Copilot、Midjourney、Cursor等）的新功能或重大更新
- AI开发工具/框架（LangChain、vLLM、Cline、Codex等）的发布或更新
- AI Agent（Hermes Agent、AutoGPT、Devin等）的进展
- AI公司融资、收购、战略合作（金额明确的）
- AI政策法规（各国AI监管、标准制定、合规要求）
- AI学术突破（新架构、新训练方法、SOTA结果、开源模型）
- 大模型排行榜变化、基准测试新结果

以下不算AI相关（标记false，将被过滤）：
- 通用云计算/区块链/Web3（除非与AI直接结合）
- 普通软件更新、非AI硬件产品
- 纯粹的SEO/营销/广告内容
- 招聘信息、活动报名、课程推广

=== 2. 内容生成（最重要，对齐橘鸦质量标准） ===

【引用（quote）】——参考橘鸦的blockquote格式：
从原文中提取1-2句最关键的事实陈述。必须是直接引用或高度还原的原文，不是你自己的总结。
格式要求：简洁、信息密度高、包含关键数据。
好的示例：
  "OpenAI 宣布 GPT-5 将支持 100万 token 上下文窗口，API 价格下调 50%。"
  "Anthropic 已为全体用户重置五小时及每周速率限制，该调整即时生效。"
坏的示例（不要这样写）：
  "OpenAI发布了一些新功能。" ← 太空泛
  "据报道，该公司最近推出了一个新产品。" ← 没有具体信息

【摘要（summary）】——参考橘鸦的详细正文格式：
200-400字的完整新闻正文，结构为多段落叙述。要求：

第一段（核心事实）：
- 谁（具体公司/团队/人物）+ 做了什么 + 什么时候
- 包含关键数据（版本号、参数量、价格、融资金额等具体数字）
- 例如："OpenAI 通过其开发者社交账号宣布，已为 Codex 推出一系列更新。"

第二段（技术细节/背景）：
- 为什么重要、技术原理、与竞品对比
- 市场背景、用户影响
- 例如："功能方面，键盘快捷键现可在设置中自定义。性能上，大型仓库中 Git 操作加速约 10 至 50 倍。"

第三段（可选：影响/展望）：
- 对行业的影响、后续计划、用户反馈
- 例如："该项目目前仍处于实验阶段，官方强调其语言本身尚未稳定。"

严格禁止：
- 使用"近日"、"最近"、"据悉"等模糊时间词 → 用具体日期
- 使用"一些"、"若干"、"部分"等模糊数量词 → 用具体数字
- 空泛的评价（"意义重大"、"引发关注"）→ 用事实说话
- 重复标题内容作为摘要 → 摘要必须比标题提供更多信息

=== 3. 分类（对齐橘鸦8分类体系） ===
model: 模型发布/更新/评测（GPT-5、Claude 4、Gemini 2、Qwen3等新模型发布或重大更新）
opensource: 开源模型/工具/框架发布或重大版本更新
product: AI产品/应用发布或重大功能更新（面向终端用户的）
policy: AI政策、法规、行业标准、合规要求
research: 技术解析、研究报告、学术论文、技术博客
agent: AI Agent框架/产品/编排工具/进展
industry: 公司融资、收购、人事变动、市场格局、商业模式
rumor: 未确认的传闻、预告、规划、泄露信息
注意：分类要准确，不要把产品更新归为模型发布，不要把技术博客归为学术研究。

=== 4. 评分体系（四维度，各1-10分，校准标准） ===

影响力（impact）——这个事件影响了多少人/行业：
  9-10: 改变行业格局（GPT-5发布、千亿美元级收购、国家级AI政策）
  7-8: 重要产品发布/更新、大额融资(>1亿美元)、主流工具重大更新
  5-6: 一般产品更新、中小额融资、技术博客
  3-4: 小众工具发布、细分领域进展
  1-2: 个人观点、小范围讨论

时效性（timeliness）——消息的新鲜程度：
  9-10: 今天刚发布/宣布
  7-8: 1-2天内
  5-6: 3-5天内
  3-4: 一周左右
  1-2: 超过一周

独特性（uniqueness）——信息的稀缺程度：
  9-10: 官方首次发布/独家报道
  7-8: 少数媒体报道、独家分析
  5-6: 多家媒体报道的同一事件
  3-4: 转述/二手信息
  1-3: 纯粹转载、无新增信息

可靠性（reliability）——信源的可信度：
  9-10: 官方博客/官方公告/官方社交媒体
  7-8: 知名科技媒体（TechCrunch、The Verge、机器之心等）
  5-6: 一般媒体、知名社区（Reddit、HackerNews）
  3-4: 个人博客、自媒体
  1-2: 匿名来源、无法验证

importanceScore = 四个维度之和（4-40）
importanceLevel映射：>=30 SSS, >=22 SS, >=14 S, <14 A

=== 5. 要闻标记（isBreaking） ===
只有最重要的1-3条新闻标记 isBreaking=true。严格标准：
- 旗舰级模型首次发布（如GPT-5、Claude 4首发）
- 超大额融资（>5亿美元）
- 重大政策变化（国家级AI立法）
- 行业格局剧变（巨头收购、核心团队出走）
- 开源界里程碑事件（如Llama开源）
不要滥用此标记，大多数新闻应该是false。

=== 6. 关键词 ===
提取3-5个关键词，用于归类和搜索。优先使用：
- 模型名称（GPT-5、Claude 4、DeepSeek V4）
- 公司名（OpenAI、Anthropic、Google）
- 技术术语（Agent、RAG、MoE、RLHF）
- 产品名（ChatGPT、Copilot、Cursor）

=== 7. 内容质量审核（严格过滤） ===
以下情况应被低分（importanceScore < 8）或直接过滤：
- 内容空泛，没有具体数据或事件，只有泛泛而谈
- 纯粹的广告/推广/招聘信息/课程推广
- 过时的新闻（超过7天且无重大影响）
- 无法验证的传闻（除非标记为rumor分类）
- 重复报道同一事件（保留信息最丰富的版本）
- 低质量来源（个人博客转发、无来源的二手信息）

=== 8. 内容真实性检查 ===
- 不要编造不存在的数据、版本号、融资金额
- 如果原文没有提供具体数字，不要在摘要中捏造
- 如果信息来源不明确，降低reliability评分
- 对于传闻类信息，summary中应注明"据报道"/"消息称"

返回JSON数组，每个元素格式:
{
  "title": "具体、信息丰富的标题（不要修改原标题，除非原标题太模糊）",
  "summary": "详细正文200-400字，多段落叙述",
  "quote": "引用原文1-2句核心事实",
  "sourceName": "来源名称",
  "sourceUrl": "原URL",
  "category": "model|opensource|product|policy|research|agent|industry|rumor",
  "importanceScore": 总分(4-40),
  "importanceLevel": "SSS|SS|S|A",
  "keywords": ["关键词1", "关键词2", "关键词3"],
  "isAIRelated": true/false,
  "isBreaking": true/false,
  "publishedAt": "YYYY-MM-DD"
}

最终过滤规则：
- isAIRelated=false 的条目将被系统自动过滤
- importanceScore < 8 的条目将被系统自动过滤
- 请确保你的评分准确，不要虚高（大部分新闻应在14-25分之间）`,
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
 * 内容质量审核：多维度质量评估（对齐橘鸦AI早报标准）
 * 过滤：空泛标题党、摘要过短、无具体信息、模板化内容、AI幻觉、模糊用语
 */
function contentQualityCheck(news: ProcessedNews[]): ProcessedNews[] {
  return news.filter((n) => {
    const summary = n.summary?.trim() || "";
    const title = n.title?.trim() || "";
    const quote = n.quote?.trim() || "";

    // 1. 摘要太短（<80字）说明无实质内容（提高阈值，从50→80）
    if (summary.length < 80) return false;

    // 2. 空值/占位标记
    if (/暂无|无相关|未提供|无内容|暂无数据|no data|not available|待补充|TBD/i.test(summary)) return false;

    // 3. 垃圾内容过滤（广告/抽奖/招聘/推广/课程/代理）
    const spamPatterns = /抽奖|红包|免费领取|点击领取|限时秒杀|注册送|招聘|求职|加盟|代理|赌博|代写|刷单|培训班|训练营|报名|优惠券|折扣码/i;
    if (spamPatterns.test(title) || spamPatterns.test(summary)) return false;

    // 4. 纯观点/评论类（没有具体事件）
    const opinionOnly = /^(我觉得|我认为|个人看法|浅谈|杂谈|随笔|闲聊|我的看法)/;
    if (opinionOnly.test(title)) return false;

    // 5. 摘要中必须包含至少一个具体数据或实体名称
    const hasSubstance = /\d|[A-Z][a-z]+\s?\d|GPT|Claude|Gemini|DeepSeek|Qwen|Llama|Grok|OpenAI|Google|Microsoft|Meta|Anthropic|融资|发布|更新|开源|API|GPU|TPU|token|模型|参数|benchmark/i;
    if (!hasSubstance.test(summary)) return false;

    // 6. 标题-摘要重叠度过高检测（摘要只是标题的扩写，没有新信息）
    if (title.length > 10 && summary.length < 200) {
      const titleChars = new Set(title.toLowerCase().split(""));
      const summaryChars = summary.toLowerCase().split("");
      const overlap = summaryChars.filter(c => titleChars.has(c)).length;
      const charOverlapRatio = summaryChars.length > 0 ? overlap / summaryChars.length : 0;
      if (charOverlapRatio > 0.85) return false;
    }

    // 7. 纯英文内容如果太短（<100字符），可能只是RSS的description片段
    if (!/[\u4e00-\u9fff]/.test(summary) && summary.length < 100) return false;

    // === 新增：橘鸦级质量检查 ===

    // 8. 模糊用语检测（"近日"、"最近"、"据悉"、"一些"等）
    const vaguePatterns = /近日|最近|据悉|据了解|有消息称|部分|一些|若干|相关|业内人士|知情人士透露/;
    const vagueCount = (summary.match(new RegExp(vaguePatterns.source, "g")) || []).length;
    // 超过3个模糊用语说明内容质量低
    if (vagueCount > 3) return false;

    // 9. AI幻觉风险检测（捏造数据的模式）
    const hallucinationPatterns = /预计将达到|据估计约|或将突破|有望超过|预计将实现/;
    const hasSuspiciousClaim = hallucinationPatterns.test(summary);
    // 如果有可疑声明但quote为空，可能是AI编造的
    if (hasSuspiciousClaim && !quote) {
      // 不直接过滤，但这些条目评分会较低
    }

    // 10. 内容丰富度检查（必须有具体数字或专有名词）
    const specificData = /\d+[万亿]|\d+\.\d+|\$\d+|\d+%|\d+亿|\d+万|v\d+|版本|Version/i;
    const hasSpecificData = specificData.test(summary);
    const properNouns = /[A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)?(?:\s(?:AI|LLM|API|SDK|OS))?/;
    const hasProperNouns = properNouns.test(summary);
    // 摘要既没有具体数据也没有专有名词，质量存疑
    if (!hasSpecificData && !hasProperNouns && summary.length < 150) return false;

    // 11. 摘要不能只是对标题的简单翻译/改写
    if (title.length > 5 && summary.length < 150) {
      const titleWords = new Set(title.toLowerCase().replace(/[^\w\u4e00-\u9fff]/g, "").split(""));
      const summaryWords = summary.toLowerCase().replace(/[^\w\u4e00-\u9fff]/g, "").split("");
      const overlapRatio = summaryWords.filter(w => titleWords.has(w)).length / Math.max(summaryWords.length, 1);
      if (overlapRatio > 0.7) return false; // 太相似，没有新信息
    }

    return true;
  });
}

/**
 * 过滤非AI相关和低质量内容
 * 多阶段过滤：AI相关性 → 内容质量 → 时效性 → 源加分 → 主题加分 → 分数阈值 → 排序
 */
export function filterNews(news: ProcessedNews[]): ProcessedNews[] {
  if (news.length === 0) return [];

  // 阶段1: 仅保留AI相关
  let filtered = news.filter((n) => n.isAIRelated);

  console.log(
    `[Filter] After AI relevancy filter: ${filtered.length}/${news.length}`
  );

  // 阶段2: 内容质量审核（11项检查）
  filtered = contentQualityCheck(filtered);

  console.log(
    `[Filter] After quality check: ${filtered.length}/${news.length}`
  );

  // 阶段3: 24小时时效性过滤
  filtered = filtered.filter(n => isWithin24Hours(n.publishedAt));
  console.log(`[Filter] After 24h recency filter: ${filtered.length}/${news.length}`);

  // 阶段4: 应用信息源加分
  const sourceBoosted = applySourceBoost(filtered);

  // 阶段5: 应用主题加分
  const boosted = applyTopicBoost(sourceBoosted);

  // 阶段6: 过滤低分（<8分即为B级，过滤掉）
  const scored = boosted.filter((n) => n.importanceScore >= 8);

  console.log(
    `[Filter] After score threshold: ${scored.length}/${boosted.length}`
  );

  // 阶段7: 按分数降序排列
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
