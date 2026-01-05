-- Drop the legacy constraint that compares time_segments.date to DATE(end_time)
-- This constraint is incompatible with client-local dates when start/end are stored as TIMESTAMPTZ.

ALTER TABLE IF EXISTS public.time_segments
  DROP CONSTRAINT IF EXISTS no_midnight_cross;
