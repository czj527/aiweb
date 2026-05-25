# AI Pulse — AI资讯日报/周报网站

## 项目概览

AI Pulse 是一个 AI 资讯聚合网站，核心功能包括：
- **AI 日报**：每日自动聚合 AI 领域新闻，用 AI 生成中文摘要和分类
- **AI 周报**：每周自动汇总重大动态，含趋势洞察
- **大模型排行榜**：多维度展示主流大模型评测排名

目标用户：AI 从业者、开发者、科技爱好者

## 版本技术栈

| 维度 | 选择 |
|------|------|
| Framework | Next.js 16 (App Router) |
| Core | React 19 |
| Language | TypeScript 5 |
| UI 组件 | shadcn/ui (Radix UI) |
| Styling | Tailwind CSS 4 |
| Database | Supabase (PostgreSQL) |
| SDK | coze-coding-dev-sdk (LLM, Web Search, Fetch URL) |

## 目录结构

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
│   │   └── page.tsx            # AI日报页 (文字版热点文章 + 往期)
│   ├── news/
│   │   └── page.tsx            # 全部资讯页 (所有新闻 + 分类筛选)
│   ├── admin/
│   │   └── page.tsx            # 管理后台 (密码保护, 新闻管理, 手动触发)
│   └── api/
│       ├── daily/
│       │   ├── route.ts        # GET 日报查询 (list/date/topOnly)
│       │   └── generate/
│       │       └── route.ts    # POST 日报生成
│       ├── weekly/
│       │   ├── route.ts        # GET 周报查询 (list)
│       │   └── generate/
│       │       └── route.ts    # POST 周报生成
│       ├── news/
│       │   └── route.ts        # GET 新闻详情
│       ├── leaderboard/
│       │   ├── route.ts        # GET 排行榜 (datalearner-* sources)
│       │   └── fetch/
│       │       └── route.ts    # POST 排行榜抓取
│       ├── rss/
│       │   └── route.ts        # GET RSS Feed
│       └── admin/
│           ├── login/route.ts  # POST 管理员登录
│           ├── logout/route.ts # POST 管理员登出
│           ├── verify/route.ts # GET 验证登录状态
│           └── news/route.ts   # GET 新闻列表 / DELETE 删除新闻
├── components/
│   ├── navbar.tsx              # 全局导航组件 (日报/全部资讯/排行榜/管理)
│   └── ui/                     # shadcn/ui 组件库
├── lib/
│   ├── types.ts                # 类型定义
│   ├── mock-data.ts            # Mock 数据（开发备用）
│   ├── api-client.ts           # 前端 API 客户端
│   ├── admin-auth.ts           # 管理员JWT认证 (token存储, 24h过期)
│   ├── utils.ts                # 工具函数 (cn)
│   └── services/
│       ├── db-service.ts       # 数据库 CRUD (Supabase SDK, snake_case)
│       ├── ai-service.ts       # LLM 集成 (摘要/分类/撰写, stream+invoke)
│       ├── search-service.ts   # Web Search 集成 (SSS/SS/S/A 分层搜索)
│       ├── fetch-service.ts    # Fetch URL 集成
│       └── processor.ts        # 新闻处理 Pipeline (去重/摘要/分类/打分/来源加分)
└── storage/
    └── database/
        ├── supabase-client.ts  # Supabase 客户端
        └── shared/
            └── schema.ts       # Drizzle ORM Schema (7 tables)
```

## 构建和测试命令

- 安装依赖：`pnpm install`
- 开发：`coze dev`（端口 5000，支持 HMR）
- 构建：`pnpm run build`
- 类型检查：`pnpm ts-check`
- Lint：`pnpm lint`

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/hot?hours=24&limit=10 | 获取最近N小时热点新闻（首页用） |
| GET | /api/daily?list=true | 获取往期日报列表 |
| GET | /api/daily?date=YYYY-MM-DD | 获取指定日期日报 |
| GET | /api/daily | 获取最新日报（含全部新闻） |
| GET | /api/daily?topOnly=true | 获取最新日报（仅Top10新闻 + totalNewsCount） |
| POST | /api/daily/generate | 触发日报生成（基于已有新闻撰写文章） |
| POST | /api/news/collect | 收集资讯（仅搜索+处理+入库，不生成日报） |
| GET | /api/weekly?list=true | 获取往期周报列表 |
| GET | /api/weekly | 获取最新周报 |
| POST | /api/weekly/generate | 触发周报生成 |
| GET | /api/news?id=xxx | 获取新闻详情 |
| GET | /api/leaderboard?source=datalearner-aa | 获取排行榜 (6种source) |
| POST | /api/leaderboard/fetch | 抓取排行榜数据 |
| GET | /api/rss | RSS Feed |
| POST | /api/admin/login | 管理员登录 (password) |
| POST | /api/admin/logout | 管理员登出 |
| GET | /api/admin/verify | 验证登录状态 |
| GET | /api/admin/news | 获取全部新闻 (需认证) |
| DELETE | /api/admin/news?id=xxx | 删除新闻 (需认证) |

## 数据库表 (Supabase)

| 表名 | 说明 |
|------|------|
| news_items | 新闻条目 |
| daily_reports | 日报 |
| daily_report_news | 日报-新闻关联 |
| weekly_reports | 周报 |
| weekly_report_news | 周报-新闻关联 |
| model_leaderboard | 模型排行榜 |
| generation_logs | 生成日志 |

注意：所有列名使用 snake_case，通过 Supabase SDK (PostgREST) 访问。

## 编码规范

- TypeScript strict 模式，禁止隐式 any 和 as any
- 所有函数参数和返回值需标注类型
- 使用 pnpm 管理依赖，禁止 npm/yarn
- 颜色必须使用语义化变量（bg-background, text-foreground 等），禁止硬编码 hex/rgb
- 圆角使用 rounded-md/lg 等，禁止硬编码像素值
- Hydration：动态内容用 'use client' + useEffect + useState
- 数据库字段统一使用 snake_case，API 层做 camelCase 转换

## 设计风格

杂志风排版：Playfair Display 标题字体 + Noto Serif SC 正文，暖色纸张底色(#F4F1EA)，克制阴影，大量留白。Design Token 定义在 globals.css 的 @theme 中。

## 定时任务 (Cron)

| 任务 | 时间 | 脚本 |
|------|------|------|
| 收集资讯 + 生成日报 + 更新排行榜 | 每天 07:00 | `scripts/cron-tasks.sh all` |
| 生成周报 | 每周一 07:30 | `scripts/cron-tasks.sh weekly` |

- Cron 日志：`/app/work/logs/bypass/cron.log`
- 任务执行日志：`/app/work/logs/bypass/cron-task-*.log`
- 启动脚本：`scripts/start-cron.sh`（在 server.ts 中自动执行）
- 排行榜抓取：从 https://www.datalearner.com/leaderboards 获取真实数据
- 资讯收集与日报生成是两个独立步骤：collect 只搜索入库，generate 在已有新闻基础上撰写文章

## 当前状态

- 前端六个页面已开发完成（今日热点/日报/排行榜/详情/全部资讯/管理后台），已接入真实 API
- 首页「今日热点资讯」展示过去24h Top 10新闻（调用 /api/hot），与日报解耦
- 日报页（/daily）：独立的文字版热点文章，展示 AI 撰写的概览+关联新闻+往期
- 管理后台（/admin）：密码保护（默认 aipulse2026，环境变量 ADMIN_PASSWORD），支持删除新闻和手动触发生成
- 全部资讯页（/news）：展示所有新闻，支持分类筛选和搜索
- 后端 API 全部开发完成，使用 Supabase SDK + coze-coding-dev-sdk
- 数据库 7 张表已创建并同步到 Supabase
- 定时任务已配置（日报每天7点、周报每周一7:30、排行榜每天7点）
- 排行榜数据来源：DataLearner（6个维度：AA指数/LMArena/综合/数学/编程/Agent）
- 信息源分层搜索策略（search-service.ts）：
  - SSS级(定向)：OpenAI Blog, Google AI Blog, Google DeepMind Blog, Anthropic Blog, Microsoft AI Blog
  - SS级(定向)：Meta AI Blog, DeepSeek, 智谱AI, Hugging Face Blog, xAI Blog, NVIDIA AI Blog, Mistral AI Blog, Apple ML Blog
  - S级(通用)：机器之心, 量子位, 新智元, 36kr, TechCrunch AI, VentureBeat AI, The Verge AI, MIT Tech Review
  - A级(通用)：ArXiv cs.AI, GitHub Trending, Reddit r/ML, Product Hunt AI, Papers With Code
- 来源加分机制（processor.ts）：SSS来源+15分，SS来源+10分，S来源+5分
