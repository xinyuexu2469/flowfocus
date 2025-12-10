-- Migration: Add PRD fields for FlowFocus v2.0
-- Date: 2024-11-24
-- Description: Adds planned_date, tags, work_time_blocks, and priority_color support

-- ============================================
-- 1. Add planned_date column to tasks table
-- ============================================
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS planned_date DATE;

-- Update existing tasks: use deadline as planned_date if deadline exists
UPDATE tasks
SET planned_date = deadline::DATE
WHERE planned_date IS NULL AND deadline IS NOT NULL;

-- For tasks without deadline, set planned_date to created_at date
UPDATE tasks
SET planned_date = DATE(created_at)
WHERE planned_date IS NULL;

-- Now make planned_date required (but allow NULL temporarily for migration)
-- After migration, you can run: ALTER TABLE tasks ALTER COLUMN planned_date SET NOT NULL;

-- ============================================
-- 2. Add priority_color column
-- ============================================
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS priority_color VARCHAR(7);

-- Set default colors based on priority
UPDATE tasks
SET priority_color = CASE
  WHEN priority = 'high' THEN '#F59E0B'  -- Orange/Yellow
  WHEN priority = 'medium' THEN '#3B82F6' -- Blue
  WHEN priority = 'low' THEN '#9CA3AF'   -- Gray
  ELSE '#EF4444'  -- Red (urgent/default)
END
WHERE priority_color IS NULL;

-- ============================================
-- 3. Update priority enum to include 'urgent'
-- ============================================
-- Note: PostgreSQL doesn't support ALTER TYPE ADD VALUE in a transaction
-- You may need to run this separately:
-- ALTER TYPE task_priority ADD VALUE IF NOT EXISTS 'urgent';

-- Or if priority is VARCHAR, just ensure it accepts 'urgent'
-- (Assuming priority is already VARCHAR, no change needed)

-- ============================================
-- 4. Create tags table
-- ============================================
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  name VARCHAR(50) NOT NULL,
  category VARCHAR(20) DEFAULT 'custom',
  color VARCHAR(7),
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);
CREATE INDEX IF NOT EXISTS idx_tags_category ON tags(category);

-- ============================================
-- 5. Create task_tags junction table (many-to-many)
-- ============================================
CREATE TABLE IF NOT EXISTS task_tags (
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_task_tags_task_id ON task_tags(task_id);
CREATE INDEX IF NOT EXISTS idx_task_tags_tag_id ON task_tags(tag_id);

-- ============================================
-- 6. Create work_time_blocks table
-- ============================================
CREATE TABLE IF NOT EXISTS work_time_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  google_event_id VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_work_time_blocks_task_id ON work_time_blocks(task_id);
CREATE INDEX IF NOT EXISTS idx_work_time_blocks_date ON work_time_blocks(date);

-- ============================================
-- 7. Create user_priority_settings table
-- ============================================
CREATE TABLE IF NOT EXISTS user_priority_settings (
  user_id TEXT PRIMARY KEY,
  urgent_color VARCHAR(7) DEFAULT '#EF4444',
  high_color VARCHAR(7) DEFAULT '#F59E0B',
  medium_color VARCHAR(7) DEFAULT '#3B82F6',
  low_color VARCHAR(7) DEFAULT '#9CA3AF',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 8. Add indexes for performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_tasks_planned_date ON tasks(planned_date);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);

-- ============================================
-- 9. Update status enum if needed
-- ============================================
-- If status is an enum, you may need to add 'todo' and 'cancelled'
-- ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'todo';
-- ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'cancelled';
-- (Run separately if status is an enum type)

-- ============================================
-- Migration Complete
-- ============================================
-- After running this migration:
-- 1. Verify all columns exist: \d tasks
-- 2. Test inserting a task with planned_date
-- 3. Test creating tags and linking to tasks
-- 4. Test creating work_time_blocks

