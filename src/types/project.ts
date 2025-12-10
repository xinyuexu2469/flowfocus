export interface Project {
  id: string;
  user_id: string;
  
  // Core fields
  name: string;
  description?: string | null;
  
  // Dates
  start_date: string; // ISO date string
  deadline: string; // ISO date string
  
  // Organization
  priority: 'high' | 'medium' | 'low';
  status: 'not-started' | 'in-progress' | 'completed' | 'on-hold';
  color?: string | null; // hex color
  
  // User-defined order (CRITICAL for manual sorting)
  order: number; // 0, 1, 2, 3... (lower = higher on list)
  
  // Optional
  tags?: string[] | null;
  notes?: string | null;
  progress?: number | null; // 0-100
  
  // Metadata
  created_at: string;
  updated_at: string;
}

