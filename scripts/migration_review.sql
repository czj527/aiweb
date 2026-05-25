-- AI Pulse 审核流程迁移脚本
-- 给 news_items 增加审核字段
ALTER TABLE news_items ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'published';
ALTER TABLE news_items ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE news_items ADD COLUMN IF NOT EXISTS reject_reason TEXT;

-- 现有新闻标记为已发布
UPDATE news_items SET status = 'published' WHERE status = 'pending';

-- 创建审核日志表
CREATE TABLE IF NOT EXISTS review_logs (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  news_id VARCHAR(36) REFERENCES news_items(id) ON DELETE CASCADE,
  action VARCHAR(20) NOT NULL,
  previous_status VARCHAR(20),
  new_status VARCHAR(20),
  reviewer VARCHAR(100),
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 创建索引
CREATE INDEX IF NOT EXISTS review_logs_news_id_idx ON review_logs(news_id);
CREATE INDEX IF NOT EXISTS review_logs_created_at_idx ON review_logs(created_at);
CREATE INDEX IF NOT EXISTS news_items_status_idx ON news_items(status);
