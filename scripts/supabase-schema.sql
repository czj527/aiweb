-- ============================================================
-- AI Pulse 数据库建表 SQL
-- 在 Supabase SQL Editor 中执行
-- ============================================================

-- 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. 新闻条目表
CREATE TABLE IF NOT EXISTS news_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(500) NOT NULL,
  summary TEXT NOT NULL,
  content TEXT,
  source_name VARCHAR(200),
  source_url VARCHAR(2000),
  category VARCHAR(50) NOT NULL,
  importance_score INTEGER NOT NULL DEFAULT 0,
  importance_level VARCHAR(5) NOT NULL DEFAULT 'S',
  keywords JSONB DEFAULT '[]'::jsonb,
  published_at TIMESTAMPTZ,
  is_ai_related BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS news_items_category_idx ON news_items (category);
CREATE INDEX IF NOT EXISTS news_items_published_at_idx ON news_items (published_at);
CREATE INDEX IF NOT EXISTS news_items_importance_level_idx ON news_items (importance_level);
CREATE INDEX IF NOT EXISTS news_items_source_url_idx ON news_items (source_url);

-- 2. 日报表
CREATE TABLE IF NOT EXISTS daily_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date VARCHAR(10) NOT NULL UNIQUE,
  overview TEXT NOT NULL,
  hot_topics JSONB DEFAULT '[]'::jsonb,
  status VARCHAR(20) NOT NULL DEFAULT 'published',
  news_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS daily_reports_report_date_idx ON daily_reports (report_date);
CREATE INDEX IF NOT EXISTS daily_reports_status_idx ON daily_reports (status);

-- 3. 日报-新闻关联表
CREATE TABLE IF NOT EXISTS daily_report_news (
  id SERIAL PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES daily_reports(id) ON DELETE CASCADE,
  news_id UUID NOT NULL REFERENCES news_items(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS daily_report_news_report_id_idx ON daily_report_news (report_id);
CREATE INDEX IF NOT EXISTS daily_report_news_news_id_idx ON daily_report_news (news_id);

-- 4. 周报表
CREATE TABLE IF NOT EXISTS weekly_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start_date VARCHAR(10) NOT NULL,
  week_end_date VARCHAR(10) NOT NULL,
  week_number INTEGER NOT NULL,
  overview TEXT NOT NULL,
  tech_trends TEXT,
  industry_trends TEXT,
  investment_highlights TEXT,
  hot_topics JSONB DEFAULT '[]'::jsonb,
  status VARCHAR(20) NOT NULL DEFAULT 'published',
  news_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS weekly_reports_week_start_idx ON weekly_reports (week_start_date);
CREATE INDEX IF NOT EXISTS weekly_reports_status_idx ON weekly_reports (status);

-- 5. 周报-新闻关联表
CREATE TABLE IF NOT EXISTS weekly_report_news (
  id SERIAL PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES weekly_reports(id) ON DELETE CASCADE,
  news_id UUID NOT NULL REFERENCES news_items(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS weekly_report_news_report_id_idx ON weekly_report_news (report_id);
CREATE INDEX IF NOT EXISTS weekly_report_news_news_id_idx ON weekly_report_news (news_id);

-- 6. 大模型排行榜表
CREATE TABLE IF NOT EXISTS model_leaderboard (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source VARCHAR(50) NOT NULL DEFAULT 'lmsys',
  category VARCHAR(50) NOT NULL DEFAULT 'overall',
  model_name VARCHAR(200) NOT NULL,
  developer VARCHAR(200),
  parameters VARCHAR(50),
  score NUMERIC(8,1) NOT NULL,
  rank_position INTEGER NOT NULL,
  rank_change INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS model_leaderboard_source_cat_idx ON model_leaderboard (source, category);
CREATE INDEX IF NOT EXISTS model_leaderboard_rank_idx ON model_leaderboard (source, category, rank_position);

-- 7. 生成日志表
CREATE TABLE IF NOT EXISTS generation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(20) NOT NULL,
  target_date VARCHAR(10) NOT NULL,
  status VARCHAR(20) NOT NULL,
  discovered_count INTEGER NOT NULL DEFAULT 0,
  after_dedup_count INTEGER NOT NULL DEFAULT 0,
  after_filter_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS generation_logs_type_date_idx ON generation_logs (type, target_date);
CREATE INDEX IF NOT EXISTS generation_logs_status_idx ON generation_logs (status);

-- 8. 健康检查表（系统表）
CREATE TABLE IF NOT EXISTS health_check (
  id SERIAL NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);
