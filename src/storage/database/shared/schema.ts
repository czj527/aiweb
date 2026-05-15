import { sql } from "drizzle-orm";
import { pgTable, serial, varchar, timestamp, integer, text, boolean, jsonb, index, numeric } from "drizzle-orm/pg-core";

// 系统表 - 必须保留
export const healthCheck = pgTable("health_check", {
  id: serial().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

// 新闻条目表
export const newsItems = pgTable(
  "news_items",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    title: varchar("title", { length: 500 }).notNull(),
    summary: text("summary").notNull(),
    content: text("content"),
    source_name: varchar("source_name", { length: 200 }),
    source_url: varchar("source_url", { length: 2000 }),
    category: varchar("category", { length: 50 }).notNull(),
    importance_score: integer("importance_score").notNull().default(0),
    importance_level: varchar("importance_level", { length: 5 }).notNull().default("S"),
    keywords: jsonb("keywords").$type<string[]>(),
    published_at: timestamp("published_at", { withTimezone: true }),
    is_ai_related: boolean("is_ai_related").notNull().default(true),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("news_items_category_idx").on(table.category),
    index("news_items_published_at_idx").on(table.published_at),
    index("news_items_importance_level_idx").on(table.importance_level),
    index("news_items_source_url_idx").on(table.source_url),
  ]
);

// 日报表
export const dailyReports = pgTable(
  "daily_reports",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    report_date: varchar("report_date", { length: 10 }).notNull().unique(), // YYYY-MM-DD
    overview: text("overview").notNull(),
    hot_topics: jsonb("hot_topics").$type<string[]>(),
    status: varchar("status", { length: 20 }).notNull().default("published"),
    news_count: integer("news_count").notNull().default(0),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("daily_reports_report_date_idx").on(table.report_date),
    index("daily_reports_status_idx").on(table.status),
  ]
);

// 日报-新闻关联表
export const dailyReportNews = pgTable(
  "daily_report_news",
  {
    id: serial().primaryKey(),
    report_id: varchar("report_id", { length: 36 }).notNull().references(() => dailyReports.id, { onDelete: "cascade" }),
    news_id: varchar("news_id", { length: 36 }).notNull().references(() => newsItems.id, { onDelete: "cascade" }),
    sort_order: integer("sort_order").notNull().default(0),
  },
  (table) => [
    index("daily_report_news_report_id_idx").on(table.report_id),
    index("daily_report_news_news_id_idx").on(table.news_id),
  ]
);

// 周报表
export const weeklyReports = pgTable(
  "weekly_reports",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    week_start_date: varchar("week_start_date", { length: 10 }).notNull(), // YYYY-MM-DD
    week_end_date: varchar("week_end_date", { length: 10 }).notNull(),
    week_number: integer("week_number").notNull(),
    overview: text("overview").notNull(),
    tech_trends: text("tech_trends"),
    industry_trends: text("industry_trends"),
    investment_highlights: text("investment_highlights"),
    hot_topics: jsonb("hot_topics").$type<string[]>(),
    status: varchar("status", { length: 20 }).notNull().default("published"),
    news_count: integer("news_count").notNull().default(0),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("weekly_reports_week_start_idx").on(table.week_start_date),
    index("weekly_reports_status_idx").on(table.status),
  ]
);

// 周报-新闻关联表
export const weeklyReportNews = pgTable(
  "weekly_report_news",
  {
    id: serial().primaryKey(),
    report_id: varchar("report_id", { length: 36 }).notNull().references(() => weeklyReports.id, { onDelete: "cascade" }),
    news_id: varchar("news_id", { length: 36 }).notNull().references(() => newsItems.id, { onDelete: "cascade" }),
    sort_order: integer("sort_order").notNull().default(0),
  },
  (table) => [
    index("weekly_report_news_report_id_idx").on(table.report_id),
    index("weekly_report_news_news_id_idx").on(table.news_id),
  ]
);

// 大模型排行榜表 - 聚合权威排行榜数据
export const modelLeaderboard = pgTable(
  "model_leaderboard",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    source: varchar("source", { length: 50 }).notNull().default("lmsys"), // lmsys / huggingface / superclue / artificialanalysis
    category: varchar("category", { length: 50 }).notNull().default("overall"), // overall / code / reasoning / chinese / multimodal / hard
    model_name: varchar("model_name", { length: 200 }).notNull(),
    developer: varchar("developer", { length: 200 }),
    parameters: varchar("parameters", { length: 50 }),
    score: numeric("score", { precision: 8, scale: 1 }).notNull(), // ELO/评分
    rank_position: integer("rank_position").notNull(),
    rank_change: integer("rank_change").notNull().default(0), // 排名变化，正=上升，负=下降
    description: text("description"),
    fetched_at: timestamp("fetched_at", { withTimezone: true }).defaultNow().notNull(), // 数据抓取时间
  },
  (table) => [
    index("model_leaderboard_source_cat_idx").on(table.source, table.category),
    index("model_leaderboard_rank_idx").on(table.source, table.category, table.rank_position),
  ]
);

// 生成日志表 - 可观测性
export const generationLogs = pgTable(
  "generation_logs",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    type: varchar("type", { length: 20 }).notNull(), // daily / weekly
    target_date: varchar("target_date", { length: 10 }).notNull(),
    status: varchar("status", { length: 20 }).notNull(), // running / success / failed
    discovered_count: integer("discovered_count").notNull().default(0),
    after_dedup_count: integer("after_dedup_count").notNull().default(0),
    after_filter_count: integer("after_filter_count").notNull().default(0),
    error_message: text("error_message"),
    started_at: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    completed_at: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("generation_logs_type_date_idx").on(table.type, table.target_date),
    index("generation_logs_status_idx").on(table.status),
  ]
);
