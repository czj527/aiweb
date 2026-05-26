-- AI Memories Table Migration
-- Run this SQL in Supabase SQL Editor to create the table
-- Project: xxdkvoiwylsqfcxfkuyh.supabase.co

CREATE TABLE IF NOT EXISTS ai_memories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_memories_category ON ai_memories(category);
CREATE INDEX IF NOT EXISTS idx_ai_memories_key ON ai_memories(key);

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_ai_memories_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_ai_memories_timestamp ON ai_memories;
CREATE TRIGGER trigger_update_ai_memories_timestamp
  BEFORE UPDATE ON ai_memories
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_memories_timestamp();

-- Enable RLS (Row Level Security) - optional
ALTER TABLE ai_memories ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY IF NOT EXISTS "Service role can manage ai_memories"
  ON ai_memories
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
