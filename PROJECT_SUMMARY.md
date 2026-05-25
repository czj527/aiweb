# AI Pulse 项目完整总结与迁移指南

---

## 一、项目概览

**AI Pulse** 是一个 AI 资讯聚合网站，自动搜索全球 AI 领域新闻，用 LLM 生成中文摘要、分类和完整日报文章，并提供大模型多维度排行榜。

### 核心功能

| 功能 | 说明 |
|------|------|
| 今日热点资讯 | 首页展示过去24h Top10重要新闻，大卡片布局 |
| AI 日报 | 独立页面，展示 AI 撰写的完整文章（800-1500字），含往期列表 |
| AI 周报 | 每周汇总，含技术趋势/产业洞察/投资亮点 |
| 大模型排行榜 | 6个维度（AA智能指数/LMArena/综合/数学/编程/Agent），数据来自 DataLearner |
| 全部资讯 | 所有新闻+分类筛选+搜索 |
| 管理后台 | 密码保护，可删除新闻、手动触发资讯收集/日报/周报/排行榜 |

### 数据规模

- 新闻：210 条
- 日报：1 份
- 周报：1 份
- 排行榜：60 条（6维度×10名）

---

## 二、技术架构

### 技术栈

| 维度 | 选择 |
|------|------|
| Framework | Next.js 16 (App Router) |
| Core | React 19 |
| Language | TypeScript 5 |
| UI 组件 | shadcn/ui (Radix UI) |
| Styling | Tailwind CSS 4 |
| Database | Supabase (PostgreSQL) |
| SDK | coze-coding-dev-sdk (LLM, Web Search, Fetch URL) |

### 前端（6个页面）

| 页面 | 路径 | 说明 |
|------|------|------|
| 今日热点 | `/` | 调用 `/api/hot`，Top10大卡片布局 |
| AI日报 | `/daily` | 调用 `/api/daily`，完整文章+往期 |
| 全部资讯 | `/news` | 调用 `/api/daily`（全量），分类筛选 |
| 排行榜 | `/leaderboard` | 调用 `/api/leaderboard`，6个Tab |
| 详情页 | `/detail?id=xxx` | 调用 `/api/news`，单条新闻详情 |
| 管理后台 | `/admin` | 密码`210527`，新闻管理+手动触发 |

### 后端（16个API）

| API | 方法 | 说明 |
|-----|------|------|
| `/api/hot` | GET | 过去N小时热点新闻（hours, limit） |
| `/api/daily` | GET | 日报查询（list/date/topOnly） |
| `/api/daily/generate` | POST | 生成日报（AI撰写完整文章） |
| `/api/news/collect` | POST | 资讯收集（搜索+去重+入库，不生成日报） |
| `/api/weekly` | GET | 周报查询 |
| `/api/weekly/generate` | POST | 生成周报 |
| `/api/news` | GET | 单条新闻详情 |
| `/api/leaderboard` | GET | 排行榜查询（source参数） |
| `/api/leaderboard/fetch` | POST | 抓取排行榜数据 |
| `/api/rss` | GET | RSS Feed |
| `/api/admin/login` | POST | 管理员登录 |
| `/api/admin/logout` | POST | 管理员登出 |
| `/api/admin/verify` | GET | 验证登录状态 |
| `/api/admin/news` | GET/DELETE | 新闻管理（需认证） |

### 服务层（5个核心服务）

| 服务 | 文件 | 行数 | 说明 |
|------|------|------|------|
| ai-service.ts | `src/lib/services/` | 184 | LLM调用（摘要/分类/撰写），默认模型 doubao-seed-1-8-251228 |
| search-service.ts | `src/lib/services/` | 185 | Web Search，3轮分层搜索（SSS→SS→S） |
| fetch-service.ts | `src/lib/services/` | 98 | Fetch URL，获取网页内容 |
| processor.ts | `src/lib/services/` | 352 | 新闻处理Pipeline：去重→AI摘要→分类→打分→来源加分→筛选 |
| db-service.ts | `src/lib/services/` | 676 | 数据库CRUD，Supabase SDK，snake_case |

### 数据库（7张表）

| 表 | 说明 |
|----|------|
| news_items | 新闻条目（210条） |
| daily_reports | 日报（1份） |
| daily_report_news | 日报-新闻关联 |
| weekly_reports | 周报（1份） |
| weekly_report_news | 周报-新闻关联 |
| model_leaderboard | 排行榜（60条，6维度） |
| generation_logs | 生成日志 |

**表结构详情**（来自 `src/storage/database/shared/schema.ts`）：

```sql
-- news_items 核心字段
id UUID PRIMARY KEY
title TEXT
summary TEXT
ai_detail TEXT          -- AI生成的详细分析
source TEXT             -- 来源名称
source_url TEXT
category TEXT           -- industry/model/research/product/policy/opensource
importance_score INT
importance_level TEXT   -- 重磅/重要/关注
keywords TEXT[]         -- 关键词数组
published_at TIMESTAMP
created_at TIMESTAMP

-- daily_reports 核心字段
id UUID PRIMARY KEY
report_date DATE
overview TEXT           -- AI撰写的完整日报文章（Markdown格式，800-1500字）
hot_topics TEXT[]       -- 热门话题数组
news_count INT
created_at TIMESTAMP

-- weekly_reports 核心字段
id UUID PRIMARY KEY
week_number INT
week_start DATE
week_end DATE
overview TEXT
tech_trends TEXT
industry_trends TEXT
investment_highlights TEXT
created_at TIMESTAMP

-- model_leaderboard 核心字段
id UUID PRIMARY KEY
source TEXT             -- datalearner-aa/lmarena/comprehensive/math/code/agent
model_name TEXT
model_org TEXT
rank INT
score FLOAT
metric TEXT
category TEXT
fetched_at TIMESTAMP
```

### 定时任务

| 任务 | 时间 | 命令 |
|------|------|------|
| 收集资讯+生成日报+排行榜 | 每天 07:00 | `scripts/cron-tasks.sh all` |
| 生成周报 | 每周一 07:30 | `scripts/cron-tasks.sh weekly` |

**执行流程**：
```
cron-tasks.sh all
  ├── POST /api/news/collect    → 搜索(3轮) → 去重 → AI处理 → 入库
  ├── POST /api/daily/generate  → 从已有新闻撰写完整日报文章
  └── POST /api/leaderboard/fetch → 抓取DataLearner排行榜
```

### 设计风格

- **杂志风排版**：Playfair Display 标题 + Noto Serif SC 正文
- **暖色纸张底色** `#F4F1EA`，深色文字 `#111111`
- 克制阴影，27个 Design Token 定义在 `globals.css`
- 字体：`--font-display: "Playfair Display"` / `--font-sans: "Noto Serif SC"`
- 阴影：`--shadow-card: 0 2px 8px rgba(0,0,0,0.08)` / `--shadow-float: 0 10px 25px rgba(0,0,0,0.12)`

---

## 三、信息源配置

### 分层搜索策略

搜索按信息源可信度分3轮进行：

| 层级 | 定向/通用 | 来源 | 搜索方式 |
|------|-----------|------|----------|
| SSS | 定向 | OpenAI Blog, Google AI Blog, Google DeepMind Blog, Anthropic Blog, Microsoft AI Blog | `sites:` 限定域名 |
| SS | 定向 | Meta AI Blog, DeepSeek, 智谱AI, Hugging Face Blog, xAI Blog, NVIDIA AI Blog, Mistral AI Blog, Apple ML Blog | `sites:` 限定域名 |
| S | 通用 | 新智元, 机器之心, 量子位, 36kr, TechCrunch AI, VentureBeat AI, The Verge AI, MIT Tech Review, Alibaba/Qwen, Moonshot/Kimi | 关键词搜索 |

### 来源加分机制

| 层级 | 加分 | 说明 |
|------|------|------|
| SSS | +15 | 头部厂商官方博客 |
| SS | +10 | 重要厂商官方博客 |
| S | +5 | 权威科技媒体 |

加分在 `processor.ts` 的 `applySourceBoost()` 函数中实现，影响新闻的 `importance_score` 和首页排序。

---

## 四、外部依赖详解（迁移关键）

### 1. coze-coding-dev-sdk（最核心）

项目中有 **3个服务** 依赖此 SDK：

```typescript
// ai-service.ts - LLM调用
import { LLMClient, Config } from "coze-coding-dev-sdk";
const config = new Config();
const client = new LLMClient(config);
await client.invoke(messages, { model, temperature });

// search-service.ts - Web搜索
import { SearchClient, Config } from "coze-coding-dev-sdk";
const client = new SearchClient(config);
await client.search(query, { sites, count });

// fetch-service.ts - URL抓取
import { FetchClient, Config } from "coze-coding-dev-sdk";
const client = new FetchClient(config);
await client.fetch(url);
```

**SDK 自动从环境变量获取认证**，无需手动传入 API Key。

### 2. Supabase（数据库）

```typescript
// supabase-client.ts
import { createClient } from '@supabase/supabase-js';
// 环境变量：COZE_SUPABASE_URL, COZE_SUPABASE_ANON_KEY, COZE_SUPABASE_SERVICE_ROLE_KEY
```

通过 `coze_workload_identity` Python 模块自动获取凭证，认证流程：

```python
# 内部脚本自动执行
from coze_workload_identity import get_supabase_config
config = get_supabase_config()
# → 输出 URL / ANON_KEY / SERVICE_ROLE_KEY
```

### 3. 其他环境变量

| 变量 | 用途 | 示例值 |
|------|------|--------|
| `ADMIN_PASSWORD` | 管理员密码（默认 210527） | `210527` |
| `COZE_PROJECT_DOMAIN_DEFAULT` | 对外域名（RSS/分享链接） | `https://xxx.dev.coze.site` |
| `DEPLOY_RUN_PORT` | 服务端口 | `5000` |
| `COZE_WORKSPACE_PATH` | 项目工作目录 | `/workspace/projects/` |
| `COZE_PROJECT_ENV` | 环境标识 | `DEV` / `PROD` |

---

## 五、目录结构

```
src/
├── app/
│   ├── layout.tsx              # 根布局（Playfair Display + Noto Serif SC 字体）
│   ├── page.tsx                # 首页 - 今日热点资讯 (过去24h Top 10)
│   ├── globals.css             # 全局样式 + Design Token (27 variables)
│   ├── leaderboard/
│   │   └── page.tsx            # 大模型排行榜页 (DataLearner 6维度)
│   ├── detail/
│   │   └── page.tsx            # 新闻详情页
│   ├── daily/
│   │   └── page.tsx            # AI日报页 (完整文章 + 往期列表)
│   ├── news/
│   │   └── page.tsx            # 全部资讯页 (所有新闻 + 分类筛选)
│   ├── admin/
│   │   └── page.tsx            # 管理后台 (密码保护, 新闻管理, 手动触发)
│   └── api/
│       ├── hot/route.ts        # GET 热点新闻 (hours/limit)
│       ├── daily/
│       │   ├── route.ts        # GET 日报查询 (list/date/topOnly)
│       │   └── generate/route.ts  # POST 日报生成
│       ├── weekly/
│       │   ├── route.ts        # GET 周报查询 (list)
│       │   └── generate/route.ts  # POST 周报生成
│       ├── news/
│       │   ├── route.ts        # GET 新闻详情
│       │   └── collect/route.ts   # POST 资讯收集
│       ├── leaderboard/
│       │   ├── route.ts        # GET 排行榜 (datalearner-* sources)
│       │   └── fetch/route.ts  # POST 排行榜抓取
│       ├── rss/route.ts        # GET RSS Feed
│       └── admin/
│           ├── login/route.ts  # POST 管理员登录
│           ├── logout/route.ts # POST 管理员登出
│           ├── verify/route.ts # GET 验证登录状态
│           └── news/route.ts   # GET 新闻列表 / DELETE 删除新闻
├── components/
│   ├── navbar.tsx              # 全局导航 (今日热点/日报/全部资讯/排行榜/管理)
│   └── ui/                     # shadcn/ui 组件库
├── lib/
│   ├── types.ts                # 类型定义
│   ├── mock-data.ts            # Mock 数据（开发备用）
│   ├── api-client.ts           # 前端 API 客户端
│   ├── admin-auth.ts           # 管理员JWT认证 (HMAC签名无状态token)
│   ├── utils.ts                # 工具函数 (cn)
│   └── services/
│       ├── db-service.ts       # 数据库 CRUD (Supabase SDK, snake_case)
│       ├── ai-service.ts       # LLM 集成 (摘要/分类/撰写, stream+invoke)
│       ├── search-service.ts   # Web Search 集成 (SSS/SS/S 分层搜索)
│       ├── fetch-service.ts    # Fetch URL 集成
│       └── processor.ts        # 新闻处理 Pipeline (去重/摘要/分类/打分/来源加分)
└── storage/
    └── database/
        ├── supabase-client.ts  # Supabase 客户端
        └── shared/
            └── schema.ts       # Drizzle ORM Schema (7 tables)

scripts/
├── cron-tasks.sh               # 定时任务脚本 (daily/weekly/leaderboard/all)
└── start-cron.sh               # 启动cron守护进程
```

---

## 六、迁移改造指南

### 改造1：替换 LLM（用自己的 API Key）

**需修改文件**：`src/lib/services/ai-service.ts`

**方案A：使用 OpenAI 兼容接口**（推荐，大多数国产模型都支持）

```typescript
// 替换前
import { LLMClient, Config } from "coze-coding-dev-sdk";
const config = new Config();
const client = new LLMClient(config);

// 替换后
import OpenAI from 'openai';
const client = new OpenAI({
  apiKey: process.env.YOUR_LLM_API_KEY,
  baseURL: process.env.YOUR_LLM_BASE_URL, // 如 https://api.deepseek.com/v1
});

// chat() 函数改为：
const response = await client.chat.completions.create({
  model: "your-model-name",
  messages: messages,
  temperature,
});
return response.choices[0].message.content || "";
```

**方案B：使用其他 SDK**（如 Anthropic、Google 等）
- 安装对应 SDK（`@anthropic-ai/sdk`、`@google/generative-ai` 等）
- 改写 `chat()` 和 `chatJSON()` 函数

**需改动的 Prompt**（在 `processor.ts` 中）：
- `generateDailyArticle()`：日报文章撰写 prompt
- `processNewsItems()`：摘要/分类/关键词提取 prompt
- `generateWeeklyOverview()`：周报撰写 prompt

**需调整的模型名称**：
- 默认模型 `doubao-seed-1-8-251228` 需改为你的模型

---

### 改造2：替换 Web Search（用自己的搜索服务）

**需修改文件**：`src/lib/services/search-service.ts`

**方案A：使用 SerpAPI / Serper / Bing Search API**

```typescript
// 替换前
import { SearchClient, Config } from "coze-coding-dev-sdk";
const client = new SearchClient(config);
const results = await client.search(query, { sites, count });

// 替换后（以 Serper 为例）
const response = await fetch('https://google.serper.dev/search', {
  method: 'POST',
  headers: {
    'X-API-KEY': process.env.SERPER_API_KEY!,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ q: query, num: count }),
});
const data = await response.json();
// 将 data.organic 映射为 WebItem[] 格式
```

**关键：保持返回格式一致**

```typescript
interface WebItem {
  title: string;
  snippet: string;
  url: string;
  source?: string;
  publishedDate?: string;
}
```

**信息源配置无需改动**（`NEWS_SOURCES` 数组和 `searchTargetedSources` / `searchGeneralSources` 逻辑不变），只需替换底层搜索调用。

---

### 改造3：替换 Fetch URL（用自己的网页抓取）

**需修改文件**：`src/lib/services/fetch-service.ts`

**方案：使用 Cheerio + fetch**

```typescript
import * as cheerio from 'cheerio';

export async function fetchURL(url: string): Promise<FetchResult> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 ...' }
  });
  const html = await response.text();
  const $ = cheerio.load(html);
  const title = $('title').text();
  const content = $('article, main, .content').text();
  return { title, content, url, success: true };
}
```

---

### 改造4：替换数据库（用自己的 PostgreSQL）

**需修改文件**：`src/storage/database/supabase-client.ts`、`src/lib/services/db-service.ts`

**方案A：继续用 Supabase（自建实例）**
- 只需修改 `COZE_SUPABASE_URL` 和 `COZE_SUPABASE_ANON_KEY` 环境变量
- 建表 SQL 可从 `src/storage/database/shared/schema.ts` 推导
- 需在你的 Supabase 实例中执行建表 SQL

**方案B：使用独立 PostgreSQL**

```typescript
// 替换 supabase-client.ts
import { Pool } from 'pg';
const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});
export { pool };
```

**db-service.ts 改造**：
- 当前用 Supabase SDK 的 `supabase.from('news_items').select('*')` 等 PostgREST 风格
- 需改为 `pool.query('SELECT * FROM news_items WHERE ...')` 等 SQL 风格
- 或者引入 Drizzle ORM（schema.ts 已定义好 Drizzle schema，可直接用）
- 工作量约 2-3 天，676 行代码需逐函数改写

**建表 SQL**（7张表 + 索引）可从 schema.ts 推导，或用 `drizzle-kit push` 自动迁移。

---

### 改造5：替换域名和部署

**需修改项**：

1. `COZE_PROJECT_DOMAIN_DEFAULT` 环境变量 → 你的域名
2. `src/app/api/rss/route.ts` 中的 RSS link → 你的域名
3. `scripts/cron-tasks.sh` 中的 `BASE_URL` → 你的域名
4. `.coze` 配置文件的 build/run 命令 → 你的部署脚本

**部署方式**：
- 当前用 `coze dev` / `coze build` / `coze start`
- 改为自己的部署：`pnpm build && pnpm start`（Next.js 标准方式）
- 或 Docker 容器化部署
- Cron 任务：改用系统 crontab 或云服务商的定时任务

---

### 改造6：管理密码

当前用 HMAC 签名无状态 token（`src/lib/admin-auth.ts`）：
- 密码从 `ADMIN_PASSWORD` 环境变量读取，默认 `210527`
- 迁移时改环境变量即可，代码无需改动
- 如需更安全的认证（用户表/JWT/OAuth），需重写 admin-auth.ts

---

## 七、迁移优先级建议

| 优先级 | 改造项 | 难度 | 工作量 | 改动范围 |
|--------|--------|------|--------|----------|
| P0 | 替换 LLM API | 低 | 半天 | 1个文件 |
| P0 | 替换数据库 | 中 | 2-3天 | 2个文件 |
| P1 | 替换 Web Search | 低 | 半天 | 1个文件 |
| P1 | 替换 Fetch URL | 低 | 2小时 | 1个文件 |
| P2 | 域名和部署 | 低 | 半天 | 环境变量+脚本 |
| P3 | 管理认证增强 | 低 | 1天 | 按需 |

**最简迁移路径**：先替换 LLM → 再替换 Search → 再替换数据库 → 最后换域名部署。每一步都可独立验证。

---

## 八、已知限制与注意事项

1. **日报文章格式**：已有的日报 overview 是旧格式（短概览），只有新生成的日报才是完整文章格式。需手动触发一次日报生成来覆盖。

2. **排行榜数据**：来自 DataLearner 网站抓取，如果该网站结构变化需要调整 `leaderboard/fetch/route.ts` 中的解析逻辑。

3. **LLM 响应截断**：`chatJSON()` 中有 JSON 修复逻辑（自动补全截断的 JSON），换模型后需测试是否还会截断。

4. **Supabase 连接**：通过 `coze_workload_identity` Python 模块自动获取凭证，迁移数据库时需要完全替换此认证流程。

5. **Cron 依赖**：定时任务依赖系统 crontab，迁移到新环境需重新配置。

6. **排行榜抓取**：`/api/leaderboard/fetch` 使用 FetchClient + LLM 解析网页，换环境后需确保 LLM 能正确解析 HTML 表格数据。
