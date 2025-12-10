export interface TimeSegment {
  id: string;
  user_id: string;
  task_id: string;

  // === TIER 1: Core Fields ===
  title: string; // Default: task.title, can override
  title_is_custom: boolean; // Track if title is customized
  date: string; // 'YYYY-MM-DD'
  start_time: string; // ISO datetime
  end_time: string; // ISO datetime
  duration: number; // Minutes (auto-calculated)

  // === TIER 2: Status ===
  status: 'planned' | 'in-progress' | 'completed';

  // === TIER 3: Optional ===
  description?: string | null;
  notes?: string | null; // Session-specific notes
  color?: string | null; // Can override task.color
  tags?: string[] | null;

  // === TIER 4: Recurring (V1 Feature) ===
  recurring?: {
    frequency: 'daily' | 'weekly' | 'monthly';
    interval: number;
    until?: string; // ISO date
    count?: number;
  } | null;

  // === TIER 5: System ===
  order: number; // Session 1, 2, 3...
  google_calendar_event_id?: string | null;
  source: 'app' | 'google' | 'task';
  created_at: string;
  updated_at: string;
  deleted_at?: string | null; // Soft delete
}

