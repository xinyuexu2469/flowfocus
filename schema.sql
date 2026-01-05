-- ============================================
-- Focus Flow Database Schema for Neon Postgres
-- ============================================
-- This schema is adapted from Supabase migrations for use with Neon Postgres
-- Note: Neon doesn't have Supabase's auth.users table, so we create our own users table

-- ============================================
-- ENUMS
-- ============================================

-- Create enum for task priority
DO $$ BEGIN
  CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create enum for task status
DO $$ BEGIN
  CREATE TYPE task_status AS ENUM ('todo', 'in_progress', 'completed', 'backlog', 'planned');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create enum for goal tier
DO $$ BEGIN
  CREATE TYPE goal_tier AS ENUM ('life', 'stage');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================
-- USERS TABLE (replaces Supabase auth.users)
-- ============================================

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PROFILES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- GOALS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tier goal_tier NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  parent_goal_id UUID REFERENCES public.goals(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TASKS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  planned_date DATE,
  deadline TIMESTAMPTZ,
  priority task_priority DEFAULT 'medium',
  priority_color VARCHAR(7),
  status task_status DEFAULT 'todo',
  tags TEXT[] DEFAULT '{}',
  color VARCHAR(7),
  estimated_minutes INTEGER,
  planned_start TIMESTAMPTZ,
  planned_end TIMESTAMPTZ,
  goal_id UUID REFERENCES public.goals(id) ON DELETE SET NULL,
  
  -- Subtask support
  parent_task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  
  -- Additional fields
  scheduled_time INTEGER DEFAULT 0,
  project_id UUID,
  start_date DATE,
  default_session_length INTEGER,
  external_links JSONB,
  completed_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  
  -- Order for sorting
  "order" INTEGER NOT NULL DEFAULT 0,
  
  -- Google Calendar sync
  google_calendar_event_id TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT tasks_not_self_parent CHECK (id != parent_task_id)
);

-- ============================================
-- TIME SEGMENTS TABLE (formerly time_blocks)
-- ============================================

CREATE TABLE IF NOT EXISTS public.time_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Time fields
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  date DATE NOT NULL,
  duration INTEGER, -- in minutes
  
  -- Content
  title VARCHAR(255) NOT NULL,
  title_is_custom BOOLEAN DEFAULT FALSE,
  description TEXT,
  notes TEXT,
  
  -- Status and ordering
  status VARCHAR(50) DEFAULT 'planned',
  "order" INTEGER DEFAULT 1,
  
  -- Display
  color VARCHAR(7),
  tags TEXT[],
  
  -- Recurring
  recurring JSONB,
  
  -- Google Calendar sync
  google_calendar_event_id TEXT,
  source VARCHAR(50) DEFAULT 'app',
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT valid_times CHECK (end_time > start_time),
  -- NOTE: midnight-cross validation is handled at the API layer using client tz offset.
  -- Storing start_time/end_time as TIMESTAMPTZ makes DATE(end_time) dependent on DB timezone,
  -- which can conflict with client-local date.
);

-- ============================================
-- PROJECTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Core fields
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Dates
  start_date DATE NOT NULL,
  deadline DATE NOT NULL,
  
  -- Organization
  priority VARCHAR(50) DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  status VARCHAR(50) DEFAULT 'not-started' CHECK (status IN ('not-started', 'in-progress', 'completed', 'on-hold')),
  color VARCHAR(7), -- hex color
  
  -- User-defined order
  "order" INTEGER NOT NULL DEFAULT 0,
  
  -- Optional
  tags TEXT[],
  notes TEXT,
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_dates CHECK (deadline >= start_date)
);

-- ============================================
-- GOOGLE CALENDAR TOKENS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.google_calendar_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expiry TIMESTAMPTZ NOT NULL,
  calendar_id TEXT,
  sync_enabled BOOLEAN DEFAULT true,
  last_sync TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

-- Tasks indexes
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON public.tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id ON public.tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_order ON public.tasks(user_id, "order");
CREATE INDEX IF NOT EXISTS idx_tasks_deleted ON public.tasks(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_google_event_id ON public.tasks(google_calendar_event_id) WHERE google_calendar_event_id IS NOT NULL;

-- Time segments indexes
CREATE INDEX IF NOT EXISTS idx_time_segments_task_id ON public.time_segments(task_id);
CREATE INDEX IF NOT EXISTS idx_time_segments_user_id ON public.time_segments(user_id);
CREATE INDEX IF NOT EXISTS idx_time_segments_user_date ON public.time_segments(user_id, date);
CREATE INDEX IF NOT EXISTS idx_time_segments_time_range ON public.time_segments(start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_time_segments_deleted ON public.time_segments(deleted_at) WHERE deleted_at IS NOT NULL;

-- Projects indexes
CREATE INDEX IF NOT EXISTS idx_projects_user_order ON public.projects(user_id, "order");
CREATE INDEX IF NOT EXISTS idx_projects_dates ON public.projects(start_date, deadline);

-- Goals indexes
CREATE INDEX IF NOT EXISTS idx_goals_user_id ON public.goals(user_id);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================
-- TRIGGERS
-- ============================================

-- Update triggers for updated_at
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_goals_updated_at
  BEFORE UPDATE ON public.goals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_time_segments_updated_at
  BEFORE UPDATE ON public.time_segments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_google_tokens_updated_at
  BEFORE UPDATE ON public.google_calendar_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

