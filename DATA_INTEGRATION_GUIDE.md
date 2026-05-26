# AI Pulse 首页改版 — 后端数据对接指南

## 一、改版核心思路

首页从「单日资讯面板」改为「最近一周时间线」，纵向排列 7 个每日大卡片。每个卡片代表一天，内部有分类标签栏 + 资讯网格。

```
首页布局
├── 导航栏
├── 每日大卡片（今天）
│   ├── 日期标题
│   ├── 分类标签栏（横向，宽度按资讯数比例）
│   └── 资讯网格（auto-fill 自适应）
├── 每日大卡片（昨天）
│   └── ...
├── 每日大卡片（前天）
│   └── ...
└── ...（共7天）
```

## 二、前端需要的数据结构

### 2.1 首页数据格式

前端当前使用静态 `MOCK_DAYS` 数组，后期需替换为 API 返回的真实数据。

```typescript
// 前端期望的数据结构
interface NewsItem {
  id: string;           // 新闻唯一ID（用于跳转参数）
  title: string;        // 标题
  source: string;       // 来源名称
  sourceUrl: string;    // 原文链接
  summary: string;      // 摘要（1-2句话）
  publishedAt: string;  // 发布时间 ISO 格式
  imageUrl?: string;    // 封面图（可选）
}

interface CategoryGroup {
  category: string;     // 分类名称（如"大模型"/"应用"/"芯片"...）
  count: number;        // 该分类下的资讯数量（用于标签宽度计算）
  items: NewsItem[];    // 该分类下的资讯列表
}

interface DayData {
  date: string;         // 日期 YYYY-MM-DD
  dateLabel: string;    // 展示标签（如"今天 · 6月15日"）
  categories: CategoryGroup[];
}
```

### 2.2 数据分组逻辑

前端需要后端按以下方式组织数据：

1. **按日期分组**：取最近 7 天（含今天），每天一个 `DayData`
2. **按分类分组**：每天内部，按分类字段分组为 `CategoryGroup[]`
3. **排序规则**：
   - 日期倒序（今天 → 昨天 → 前天...）
   - 每个分类内部按 `published_at` 倒序

### 2.3 分类标签宽度计算

前端标签栏使用 CSS `flex-grow` 实现宽度比例：

```
标签宽度比例 = 该分类资讯数量 / 当天总资讯数量
```

前端代码中已实现：
```typescript
const totalCount = day.categories.reduce((sum, c) => sum + c.count, 0);
const flexGrow = (cat.count / totalCount) * 10;
```

后端只需返回 `count` 字段，前端自动计算比例。

## 三、API 接口

### 3.1 已有接口（可复用）

| 接口 | 说明 |
|------|------|
| `GET /api/juya/news` | 获取橘鸦当日 RSS 资讯（直接调 RSS） |
| `GET /api/daily?date=YYYY-MM-DD` | 获取指定日期日报 |

### 3.2 新增接口（建议）

```
GET /api/news/recent?days=7
```

**参数**：
- `days`：查询天数（可选，默认 7，范围 1-30）

**返回示例**：
```json
{
  "success": true,
  "data": {
    "days": [
      {
        "date": "2025-06-15",
        "dateLabel": "今天 · 6月15日",
        "categories": [
          {
            "category": "大模型",
            "count": 6,
            "items": [
              {
                "id": "uuid-1",
                "title": "OpenAI GPT-5 正式发布",
                "source": "OpenAI Blog",
                "sourceUrl": "https://openai.com/...",
                "summary": "OpenAI 发布 GPT-5，性能大幅提升...",
                "publishedAt": "2025-06-15T10:30:00Z",
                "imageUrl": "https://..."
              }
            ]
          }
        ]
      }
    ],
    "fetchedAt": "2025-06-15T12:00:00Z"
  }
}
```

**已实现参考**：`src/app/api/news/recent/route.ts`（当前从数据库查询，可复用逻辑）

## 四、数据库查询建议

### 4.1 查询最近 N 天资讯

```sql
-- 按日期+分类分组查询
SELECT 
  DATE(published_at) as date,
  category,
  COUNT(*) as count,
  json_agg(
    json_build_object(
      'id', id,
      'title', title,
      'source', source,
      'sourceUrl', source_url,
      'summary', summary,
      'publishedAt', published_at,
      'imageUrl', image_url
    ) ORDER BY published_at DESC
  ) as items
FROM news_items
WHERE published_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(published_at), category
ORDER BY date DESC, count DESC;
```

### 4.2 已有函数

`src/lib/services/db-service.ts` 中已添加 `getNewsByDateRange(startDate, endDate)`，可直接复用。

## 五、日期标签生成规则

前端根据 `date` 字段自动生成 `dateLabel`，规则如下：

```typescript
function formatDateLabel(dateStr: string): string {
  const today = new Date();
  const date = new Date(dateStr);
  const diffDays = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  
  const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekday = weekdays[date.getDay()];
  
  if (diffDays === 0) return `今天 · ${month}月${day}日`;
  if (diffDays === 1) return `昨天 · ${month}月${day}日`;
  return `${month}月${day}日 · ${weekday}`;
}
```

后端无需返回 `dateLabel`，前端自行计算。

## 六、资讯点击交互

点击资讯卡片跳转日报页，URL 格式：

```
/daily?date=YYYY-MM-DD&article={newsId}
```

- `date`：日报日期（必填）
- `article`：资讯 ID（可选，用于日报页定位到相关内容）

日报页已支持读取 `?date=` 参数自动加载指定日期。

## 七、对接步骤

1. **确认分类体系**：确定 `category` 字段的取值（建议统一为：大模型、应用、芯片、机器人、开源、政策 等）
2. **数据入库**：确保 `news_items` 表中的资讯有正确的 `published_at` 和 `category` 字段
3. **实现 API**：复用 `src/app/api/news/recent/route.ts` 或新建接口返回上述数据结构
4. **前端替换**：将 `src/app/page.tsx` 中的 `MOCK_DAYS` 替换为 API 调用

## 八、关键文件

| 文件 | 说明 |
|------|------|
| `src/app/page.tsx` | 首页组件（含 MOCK_DAYS 静态数据） |
| `src/app/api/news/recent/route.ts` | 已有 API 参考实现 |
| `src/lib/services/db-service.ts` | 数据库查询函数（含 `getNewsByDateRange`） |
| `src/app/daily/page.tsx` | 日报页（支持 `?date=` 参数） |
