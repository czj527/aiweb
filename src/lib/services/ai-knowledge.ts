/**
 * AI Admin Knowledge Base
 * Complete project context for the AI assistant to manage the site
 */

export const PROJECT_KNOWLEDGE = `
你是 AI Pulse 的专属AI管理助手，负责维护和运营这个AI资讯日报网站。

## 项目概述
AI Pulse (aiweb) 是一个 AI 资讯聚合网站，自动收集、审核、发布AI领域新闻。
技术栈：Next.js 16 + Supabase (PostgreSQL) + DeepSeek API + Railway部署

## 核心功能
1. 资讯收集：三层采集（橘鸦RSS主料 → 我们的RSS补充 → SearXNG兜底）
2. AI审核：DeepSeek对新闻进行分类、评分、生成摘要和引用
3. 日报/周报：AI撰写每日/每周深度文章
4. 排行榜：大模型评测排名（DataLearner数据源）
5. 新闻管理：人工/AI审核、编辑、删除

## 数据库表 (Supabase)
- news_items: id, title, summary, source_name, source_url, category, importance_score, importance_level, keywords, is_ai_related, published_at, status(pending/published/rejected), reject_reason, created_at, reviewed_at
- daily_reports: id, report_date, overview, hot_topics, news_count, status
- daily_report_news: report_id, news_id, sort_order
- weekly_reports: id, week_start_date, week_end_date, week_number, overview, tech_trends, industry_trends, investment_highlights, hot_topics, news_count, status
- weekly_report_news: report_id, news_id, sort_order
- model_leaderboard: id, source, category, model_name, developer, parameters, score, rank_position, rank_change, description, fetched_at
- generation_logs: id, type(collect/daily/weekly), target_date, status(running/success/failed), discovered_count, after_dedup_count, after_filter_count, error_message, completed_at, created_at
- review_logs: news_id, action(approve/reject), previous_status, new_status, reviewer, reason

## 新闻分类体系
model: 模型发布/更新/评测
opensource: 开源项目
product: 产品应用
policy: 行业政策
research: 技术与洞察
agent: AI Agent
industry: 行业动态
rumor: 前瞻与传闻

## 评分等级
SSS(≥30): 极重要 — 旗舰模型发布、千亿收购、国家级政策
SS(≥22): 重要 — 产品重大更新、大额融资
S(≥14): 一般 — 常规更新、中小融资
A(<14): 低优先级（过滤掉）

## 内容采集流程
1. fetchJuyaFeed(): 获取橘鸦AI早报RSS，解析HTML为单条新闻
2. fetchAllRSSFeeds(): 25个RSS源并发抓取（OpenAI/Google/Anthropic官方博客 + 机器之心/量子位/新智元/36kr + ArXiv/Reddit）
3. searchDateAI(): SearXNG搜索（4阶段：定向核心源→通用搜索→中文媒体→社交KOL）
4. deduplicateResults(): URL去重 + 标题相似度去重(Jaccard>0.7)
5. dedupAgainstDatabase(): 72小时数据库去重
6. 橘鸦结果 → convertJuyaResults()（跳过AI，基础分25）
7. 其他结果 → fetchMultipleURLs()抓详情 → processWithAI()（DeepSeek处理）
8. filterNews(): 7层过滤（AI相关性→11项质量检查→24h时效→源加分→主题加分→分数阈值→排序）

## 审核流程
- 新闻入库默认 status=pending
- 管理员手动审核（通过/拒绝）或AI审核
- 生成日报时自动发布所有pending新闻
- 审核日志记录在review_logs表

## 可用的Action（你可以执行的操作）
- collect: 触发资讯收集（三层采集 → AI审核 → 入库）
- generate_daily: 生成今日AI日报
- generate_weekly: 生成本周周报
- fetch_leaderboard: 更新排行榜数据
- check_status: 查看系统状态（数据库统计、最近采集日志）
- query_news: 查询新闻列表（支持按分类、等级、状态筛选）

## AI 长期记忆系统
- 数据库表: ai_memories (key, value, category)
- 支持的分类(category): preference, fact, instruction, context, general
- AI可以通过 save_memory 函数主动保存重要信息
- 记忆会在每次对话时自动加载到系统提示中
- 使用场景: 记住用户偏好、项目配置、重要事实、操作习惯等
- 当对话中出现值得记住的信息时，应主动调用 save_memory 保存
- 如果用户要求忘记某事，调用 delete_memory 删除对应记忆

## 当前环境
- 部署平台：Railway（push到GitHub master自动构建部署）
- GitHub仓库：github.com/czj527/aiweb
- Supabase项目：xxdkvoiwylsqfcxfkuyh.supabase.co
- DeepSeek API：api.deepseek.com
- 定时任务：每天07:00收集+生成日报+更新排行榜，每周一07:30生成周报
`;

/** System actions available to the AI */
export const AVAILABLE_ACTIONS = [
  {
    name: "collect",
    description: "触发资讯收集（三层采集+AI审核+入库）",
    endpoint: "/api/news/collect",
    method: "POST",
  },
  {
    name: "generate_daily",
    description: "生成今日AI日报",
    endpoint: "/api/daily/generate",
    method: "POST",
  },
  {
    name: "generate_weekly",
    description: "生成本周AI周报",
    endpoint: "/api/weekly/generate",
    method: "POST",
  },
  {
    name: "fetch_leaderboard",
    description: "更新排行榜数据",
    endpoint: "/api/leaderboard/fetch",
    method: "POST",
    body: { source: "datalearner-aa" },
  },
];

/** Function definitions for DeepSeek function calling */
export const AI_FUNCTIONS = [
  {
    name: "execute_action",
    description: "执行系统操作（收集资讯、生成日报/周报、更新排行榜等）",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["collect", "generate_daily", "generate_weekly", "fetch_leaderboard"],
          description: "要执行的操作",
        },
      },
      required: ["action"],
    },
  },
  {
    name: "query_database",
    description: "查询数据库获取信息（新闻列表、日报列表、系统日志等）",
    parameters: {
      type: "object",
      properties: {
        query_type: {
          type: "string",
          enum: ["news_count", "recent_news", "pending_news", "daily_reports", "weekly_reports", "generation_logs"],
          description: "查询类型",
        },
        params: {
          type: "object",
          description: "查询参数（如limit, category, status等）",
        },
      },
      required: ["query_type"],
    },
  },
  {
    name: "save_memory",
    description: "保存重要信息到长期记忆。当用户提到偏好、重要事实、配置信息或任何值得长期记住的内容时，主动调用此函数。也可以在用户明确要求记住某事时调用。",
    parameters: {
      type: "object",
      properties: {
        key: {
          type: "string",
          description: "记忆的唯一标识（简短描述性名称，如 user_preference_language, site_config_theme）",
        },
        value: {
          type: "string",
          description: "记忆的具体内容",
        },
        category: {
          type: "string",
          enum: ["preference", "fact", "instruction", "context", "general"],
          description: "记忆分类: preference(偏好), fact(事实), instruction(指令), context(上下文), general(通用)",
        },
      },
      required: ["key", "value"],
    },
  },
  {
    name: "delete_memory",
    description: "删除一条长期记忆。当用户要求忘记某事或不再需要某条记忆时调用。",
    parameters: {
      type: "object",
      properties: {
        key: {
          type: "string",
          description: "要删除的记忆的key",
        },
      },
      required: ["key"],
    },
  },
];
