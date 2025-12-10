-- 创建 Google Calendar tokens 表
CREATE TABLE IF NOT EXISTS google_calendar_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  last_sync_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_google_calendar_tokens_user ON google_calendar_tokens(user_id);

-- 确保 time_segments 有必要的字段
ALTER TABLE time_segments 
ADD COLUMN IF NOT EXISTS google_calendar_event_id VARCHAR(255);

ALTER TABLE time_segments 
ADD COLUMN IF NOT EXISTS read_only BOOLEAN DEFAULT false;

-- 添加唯一索引防止重复同步
CREATE UNIQUE INDEX IF NOT EXISTS idx_time_segments_google_event 
ON time_segments(google_calendar_event_id) 
WHERE google_calendar_event_id IS NOT NULL AND deleted_at IS NULL;

-- 添加索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_time_segments_source ON time_segments(source);
CREATE INDEX IF NOT EXISTS idx_time_segments_read_only ON time_segments(read_only);

COMMENT ON TABLE google_calendar_tokens IS 'Stores Google Calendar OAuth tokens for each user';
COMMENT ON COLUMN time_segments.google_calendar_event_id IS 'Google Calendar event ID for synced events';
COMMENT ON COLUMN time_segments.read_only IS 'Whether this segment is read-only (from Google Calendar)';

