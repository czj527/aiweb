# AI 资讯网站开发计划

## 概述

构建一个以 **AI 日报/周报**为核心、附带**大模型排行榜**的资讯网站。内容完全由 AI 自动化驱动——后端定时抓取多源 AI 新闻，经 LLM 严格筛选（仅保留与 AI 直接相关的内容）、提炼为中文摘要并分类，用户以极简日报/周报形式快速掌握 AI 动态；排行榜展示主流大模型多维度评测数据。平台为 Web 端。

**核心约束**：
- **AI 相关性严格过滤**：LLM 在生成摘要时同时判断内容是否与 AI 直接相关，非 AI 内容自动剔除
- **时效性硬约束**：日报仅收录前一天（UTC）的资讯，周报仅收录上一周的资讯，按 published_at 严格过滤
- **信息源精选**：优先从权威 AI 信源抓取（OpenAI Blog、Anthropic Blog、Google AI Blog、机器之心、量子位、TechCrunch AI、The Verge AI、Hugging Face Blog、arXiv AI 等），避免低质内容

集成能力：LLM（摘要生成）、Web Search（新闻源抓取）、Fetch URL（内容提取）、Supabase（数据持久化）。

## 技术方案

| 维度 | 选择 | 理由 |
|------|------|------|
| 框架 | Next.js 16 (App Router) | 全栈能力，API Routes 做后端，SSR/SSG 提升首屏 |
| UI | shadcn/ui + Tailwind CSS 4 | 一致的设计系统，极简日报风格 |
| 语言 | TypeScript 5 | 类型安全 |
| 数据库 | Supabase (PostgreSQL) | 结构化存储新闻、模型排行数据 |
| AI-摘要 | coze-coding-dev-sdk LLM | 多源新闻摘要生成 |
| AI-搜索 | coze-coding-dev-sdk Web Search | 新闻源发现与抓取 |
| AI-抓取 | coze-coding-dev-sdk Fetch URL | 提取网页正文 |
| 定时任务 | Next.js API Route + 外部 cron 或手动触发 | 日报自动生成 |

## 功能模块

### 1. AI 日报

**职责**：每日自动聚合 AI 领域新闻，生成中文摘要，按分类展示。

**数据结构**：
```
news_article {
  id: uuid
  title: string          // AI 生成的中文标题
  summary: string        // AI 摘要，200字内
  source_url: string     // 原文链接
  source_name: string    // 来源名（如 TechCrunch, 机器之心）
  category: string       // 分类标签（大模型/Agent/开源/融资/产品发布...）
  published_at: datetime // 发布时间
  created_at: datetime   // 入库时间
  daily_date: date       // 归属日报日期
  importance: number     // AI 评分 1-5
}
```

**信息源（精选优先）**：
- 官方博客：OpenAI Blog、Anthropic Blog、Google AI Blog、Meta AI Blog、Microsoft AI Blog
- 中文媒体：机器之心、量子位、新智元、AIbase
- 英文媒体：TechCrunch AI、The Verge AI、Wired AI、MIT Technology Review
- 社区源：Hugging Face Blog、arXiv AI、GitHub Trending AI、Reddit r/MachineLearning
- 企业动态：各 AI 公司官方公告、产品更新页面

**要点**：
- 后端 API `/api/daily/generate` 调用 Web Search 搜索昨日 AI 热点（时间范围限定前一天 UTC）→ Fetch URL 提取正文 → LLM 判断 AI 相关性（非 AI 内容丢弃）→ LLM 生成摘要+分类+评分 → 入库
- 时效性硬约束：日报 `daily_date` 严格等于昨天，按 `published_at` 过滤非昨日内容
- 分类筛选：大模型 / Agent / 开源 / 融资 / 产品发布 / 政策法规

### 2. AI 周报

**职责**：每周自动汇总上一周的 AI 领域重大动态，生成结构化周报。

**数据结构**：
```
weekly_report {
  id: uuid
  week_start: date       // 周一日期
  week_end: date         // 周日日期
  summary: text          // AI 生成的周度总结
  highlights: jsonb      // 本周精选 [{title, summary, category, importance}]
  trends: text           // AI 分析的趋势洞察
  created_at: datetime
}
```

**要点**：
- 后端 API `/api/weekly/generate` 汇总上一周所有 news_article → LLM 生成周度总结+趋势分析
- 时效性硬约束：仅收录上一周（周一至周日）的资讯
- 周报包含：本周概览、分类精选、趋势洞察

### 3. 大模型排行榜

**职责**：展示主流大模型在多维度基准上的评测排名。

**数据结构**：
```
llm_model {
  id: uuid
  name: string           // 模型名（如 GPT-4o, Claude 4 Sonnet）
  provider: string       // 提供商（OpenAI, Anthropic, Google...）
  category: string       // 类别（闭源/开源/本地）
  params_count: string   // 参数量（如 685B）
  release_date: date
  scores: jsonb          // 各维度分数 { "mmlu": 92, "humaneval": 88, "arena_elo": 1300, ... }
  logo_url: string       // 模型 logo 图片
  updated_at: datetime
}
```

**要点**：
- 预置主流模型数据（MMLU、HumanEval、Arena Elo、MT-Bench 等）
- 支持按不同维度排序
- 后台 API `/api/leaderboard/refresh` 可定期刷新数据

### 4. 新闻详情

**职责**：展示单条新闻的完整 AI 摘要、原文链接、相关新闻推荐。

## 是否有原型设计

是（设计引导工具已开启）

## 实施步骤

1. **阶段一：原型设计** — 加载 design-canvas 技能，设计首页（AI日报/周报切换）、排行榜页、新闻详情页的 HTML 原型。原型完成后提示用户确认，确认后进入开发。涉及：3 个原型 HTML 页面

2. **阶段二：初始化项目与基础设施** — 使用 `coze init` 初始化 Next.js 项目，配置 shadcn 全局主题，初始化 Supabase 数据库表结构（news_article、weekly_report、llm_model）。涉及：`globals.css`、Supabase schema

3. **后端 API 开发** — 实现日报生成 API（搜索→相关性判断→抓取→摘要→入库，严格限定前一天）、周报生成 API（汇总上周→趋势分析）、日报/周报查询 API、排行榜 CRUD API、新闻详情 API。涉及：`src/app/api/daily/`、`src/app/api/weekly/`、`src/app/api/leaderboard/`、`src/app/api/news/`

4. **前端页面开发** — 基于原型实现首页（日报/周报切换+分类筛选）、排行榜页（模型排名表格+维度切换）、新闻详情页（摘要+来源+相关推荐）。涉及：`src/app/page.tsx`、`src/app/leaderboard/page.tsx`、`src/app/detail/page.tsx`

5. **集成测试与验证** — 调用日报生成 API 验证完整链路，测试所有页面交互和 API 接口，修复问题。涉及：test_run 接口冒烟测试

## 页面规格

##### @nav(web-topbar)
> type: topbar
> platform: web

- @page(/) 首页·AI日报
- @page(/leaderboard) 大模型排行榜

---

##### @page(/) AI日报/周报首页

**核心职责**：以极简日报/周报形式展示 AI 领域精选新闻摘要。
**访问路径**：顶部导航直达。
**布局**：顶部导航栏 → 日报/周报切换标签 → 日期选择器（日报切换历史日期，周报切换历史周）→ 分类标签栏（全部/大模型/Agent/开源/融资/产品发布/政策法规）→ 新闻卡片列表。日报每张卡片包含：标题、摘要（2-3行）、来源名、发布时间、重要度标记。周报模式额外展示：本周概览、趋势洞察。
**列表项字段**：标题 / 摘要 / 来源 / 分类 / 时间 / 重要度
**状态**：
- 空态：「今日日报尚未生成」+ 手动生成按钮
- 加载态：骨架屏
- 错误态：「生成失败，请稍后重试」

**交互说明**

| 元素 | 动作 | 响应 | 传参 | 备注 |
|------|------|------|------|------|
| Logo | 点击 | 跳转 @page(/) | — | — |
| 日报/周报切换 | 点击 | 切换到对应模式 | mode | 默认日报 |
| 日期选择器 | 选择日期 | 切换到对应日期的日报/周报 | date | 日报默认昨天，周报默认上周 |
| 分类标签 | 点击 | 筛选当前分类新闻 | category | — |
| 新闻卡片 | 点击 | 跳转 @page(/detail)?news_id | news_id | — |
| 手动生成按钮 | 点击 | 触发日报/周报生成 | — | 仅空态显示 |
| 大模型排行榜 | 点击导航 | 跳转 @page(/leaderboard) | — | — |

---

##### @page(/leaderboard) 大模型排行榜

**核心职责**：展示主流大模型在多维度基准上的评测排名。
**访问路径**：顶部导航直达。
**布局**：顶部导航栏 → 页面标题「大模型排行榜」→ 维度切换标签（综合/MMLU/HumanEval/Arena Elo/MT-Bench）→ 模型排行表格。表格列：排名、模型名（含logo）、提供商、参数量、类别、当前维度分数。支持按类别筛选（全部/闭源/开源/本地）。
**列表项字段**：排名 / 模型名 / 提供商 / 参数量 / 类别 / 分数
**状态**：
- 加载态：表格骨架屏
- 错误态：「数据加载失败」

**交互说明**

| 元素 | 动作 | 响应 | 传参 | 备注 |
|------|------|------|------|------|
| Logo | 点击 | 跳转 @page(/) | — | — |
| 维度标签 | 点击 | 切换排序维度，重新排序 | dimension | — |
| 类别筛选 | 点击 | 筛选模型类别 | category | — |
| 表格行 | 点击 | 无跳转 | — | 后续可扩展为详情页 |
| AI日报 | 点击导航 | 跳转 @page(/) | — | — |

---

##### @page(/detail) 新闻详情

**核心职责**：展示单条 AI 新闻的完整摘要与原文信息。
**访问路径**：从首页新闻卡片进入；缺少 news_id 时降级跳转首页。
**布局**：顶部导航栏 → 返回按钮 + 来源标签 → 标题 → 完整摘要 → 元信息区（来源名、原文链接、发布时间、分类标签）→ 相关新闻推荐列表。
**状态**：
- 加载态：内容骨架屏
- 错误态（无 news_id）：跳转 @page(/)

**交互说明**

| 元素 | 动作 | 响应 | 传参 | 备注 |
|------|------|------|------|------|
| Logo | 点击 | 跳转 @page(/) | — | — |
| 返回按钮 | 点击 | 返回 @page(/) | — | — |
| 原文链接 | 点击 | 新窗口打开原文URL | — | 外链 |
| 相关新闻卡片 | 点击 | 跳转 @page(/detail)?news_id | news_id | — |
