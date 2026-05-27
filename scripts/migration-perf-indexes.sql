-- ============================================================
-- AI Pulse 性能优化索引
-- 在 Supabase SQL Editor 中执行
-- ============================================================

-- 新闻去重查询优化：合并索引（title + source_url + published_at）
CREATE INDEX IF NOT EXISTS news_items_dedup_idx
  ON news_items (published_at DESC, source_url);

-- 首页按日期范围查询优化
CREATE INDEX IF NOT EXISTS news_items_published_category_idx
  ON news_items (published_at DESC, category);

-- 减少 seq scan：覆盖索引加速 select title, source_url
CREATE INDEX IF NOT EXISTS news_items_title_source_url_idx
  ON news_items (published_at DESC) INCLUDE (title, source_url);

-- 日报按日期查询加速
CREATE INDEX IF NOT EXISTS daily_reports_date_status_idx
  ON daily_reports (report_date DESC, status);

-- 日报新闻关联查询加速
CREATE INDEX IF NOT EXISTS daily_report_news_report_order_idx
  ON daily_report_news (report_id, sort_order);

-- 生成日志按时间查询加速
CREATE INDEX IF NOT EXISTS generation_logs_created_idx
  ON generation_logs (created_at DESC);
