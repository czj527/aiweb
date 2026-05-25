-- 补全 news_items 表缺失的列
ALTER TABLE news_items ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'published';
ALTER TABLE news_items ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE news_items ADD COLUMN IF NOT EXISTS reject_reason TEXT;

-- 补全索引
CREATE INDEX IF NOT EXISTS news_items_status_idx ON news_items (status);

-- 启用 RLS
ALTER TABLE news_items ENABLE ROW LEVEL SECURITY;

-- anon 可读已发布新闻
CREATE POLICY IF NOT EXISTS "anon can read published news"
  ON news_items FOR SELECT
  TO anon
  USING (status = 'published');

-- service_role 完全访问
CREATE POLICY IF NOT EXISTS "service_role full access"
  ON news_items FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 其他表也启用 RLS 和 service_role 访问
ALTER TABLE daily_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "service_role full access daily_reports"
  ON daily_reports FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "anon can read published daily_reports"
  ON daily_reports FOR SELECT
  TO anon
  USING (status = 'published');

ALTER TABLE weekly_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "service_role full access weekly_reports"
  ON weekly_reports FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "anon can read published weekly_reports"
  ON weekly_reports FOR SELECT
  TO anon
  USING (status = 'published');

ALTER TABLE model_leaderboard ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "service_role full access model_leaderboard"
  ON model_leaderboard FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "anon can read model_leaderboard"
  ON model_leaderboard FOR SELECT
  TO anon
  USING (true);

ALTER TABLE generation_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "service_role full access generation_logs"
  ON generation_logs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- review_logs 表
CREATE TABLE IF NOT EXISTS review_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  news_id UUID NOT NULL REFERENCES news_items(id) ON DELETE CASCADE,
  action VARCHAR(20) NOT NULL,
  previous_status VARCHAR(20),
  new_status VARCHAR(20),
  reviewer VARCHAR(50),
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
