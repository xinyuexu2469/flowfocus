import { parseISO, startOfDay } from 'date-fns';
import { Task } from '@/stores/taskStore';
import { TimeSegment } from '@/types/timeSegment';

/**
 * Normalize a date to midnight (zero out hours/minutes/seconds/milliseconds)
 * Matches the specification: returns a new Date with only year/month/date set
 */
export function normalizeToDate(dateLike: Date | string): Date {
  const d = typeof dateLike === 'string' ? parseISO(dateLike) : dateLike;
  // Create new Date with only year, month, date (zero out time components)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

/**
 * Get the box dates (calendar dates) that a task belongs to.
 * 
 * Rules:
 * - If task has no Work Time Blocks (segments): belongs to the box of its creation date (created_at)
 * - If task has one or more Work Time Blocks: belongs to the boxes determined by segment dates
 * - The created_at no longer matters for box membership once there is at least one segment
 * - A task can belong to multiple dates (boxes)
 * 
 * @param task The task to get box dates for
 * @param segmentsByTask Map of task ID to TimeSegment[] (Work Time Blocks)
 * @returns Array of Date objects representing the dates (boxes) this task belongs to
 */
export function getTaskBoxDates(
  task: Task,
  segmentsByTask: Map<string, TimeSegment[]>
): Date[] {
  const segments = segmentsByTask.get(task.id) || [];
  
  // Filter out deleted segments
  const activeSegments = segments.filter(s => !s.deleted_at);
  
  // If task has segments, use segment dates
  if (activeSegments.length > 0) {
    const dates = new Set<string>();
    
    for (const segment of activeSegments) {
      // Extract date from segment's start_time
      const start = parseISO(segment.start_time);
      const normalized = normalizeToDate(start);
      // Use ISO date string as key for deduplication
      dates.add(normalized.toISOString().slice(0, 10));
    }
    
    // Convert back to Date objects
    return Array.from(dates).map(str => parseISO(str));
  }
  
  // If no segments, use planned_date (the "createdDate" - the date selected when creating the task)
  // The requirement states: "When a task is created and has NO Work Time Blocks yet:
  // It belongs to the box of the day it was created (the date selected in the Tasks view when clicking 'Add Task')."
  // This date is stored in planned_date, which is required when creating a task.
  if (task.planned_date) {
    const plannedDate = normalizeToDate(task.planned_date);
    return [plannedDate];
  }
  
  // Fallback: if no planned_date, use created_at (shouldn't happen in practice since planned_date is required)
  if (task.created_at) {
    const createdDate = normalizeToDate(task.created_at);
    return [createdDate];
  }
  
  // No box dates if task has no segments, no created_at, and no planned_date
  return [];
}

