-- ============================================================
-- 迁移脚本：为 news_items 表添加 quote 和 is_breaking 字段
-- 在 Supabase SQL Editor 中执行
-- ============================================================

-- 添加 quote 字段（引用原文）
ALTER TABLE news_items ADD COLUMN IF NOT EXISTS quote TEXT DEFAULT '';

-- 添加 is_breaking 字段（是否为要闻）
ALTER TABLE news_items ADD COLUMN IF NOT EXISTS is_breaking BOOLEAN NOT NULL DEFAULT false;

-- 添加索引（便于查询要闻）
CREATE INDEX IF NOT EXISTS news_items_is_breaking_idx ON news_items (is_breaking) WHERE is_breaking = true;

-- 验证
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'news_items' AND column_name IN ('quote', 'is_breaking');
