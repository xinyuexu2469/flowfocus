// API version of taskStore
// Uses backend API with Clerk authentication

import { create } from 'zustand';
import { getApiClient } from '@/lib/clerk-api';
import { format, parseISO } from 'date-fns';
import { TimeSegment } from '@/types/timeSegment';

export interface Task {
  id: string;
  user_id: string;
  
  // === TIER 1: Core ===
  title: string;
  status: 'todo' | 'in_progress' | 'completed' | 'backlog' | 'planned'; // PRD: todo, in_progress, completed
  
  // === TIER 2: Planning ===
  description: string | null;
  planned_date: string | null; // PRD: The "box" date - when user plans to work on this task
  deadline: string | null;     // PRD: Actual due date (may differ from planned_date)
  priority: 'urgent' | 'high' | 'medium' | 'low'; // PRD: 4 levels
  priority_color: string | null; // PRD: Customizable color (hex)
  estimated_minutes: number | null;
  scheduled_time: number | null;
  
  // === TIER 3: Organization ===
  project_id: string | null;
  tags: string[]; // PRD: Custom tags (courses, activities, life)
  color: string | null; // Legacy field, may be deprecated
  
  // === TIER 4: Hierarchy ===
  parent_task_id: string | null;
  order: number;
  
  // === TIER 5: Advanced ===
  start_date: string | null;
  default_session_length: number | null;
  external_links: any | null;
  
  // === TIER 6: System ===
  goal_id: string | null;
  planned_start: string | null;
  planned_end: string | null;
  created_at: string | null;
  updated_at: string | null;
  completed_at: string | null;
  deleted_at: string | null;
}

interface TasksByDate {
  [date: string]: Task[];
}

/**
 * Per-box ordering: Maps box keys to ordered task IDs
 * Box key formats:
 * - Day: "day:yyyy-MM-dd" (for Daily Gantt and Calendar Day view)
 * - Week: "week:yyyy-MM-dd" (week start date for Calendar Week/Agenda view)
 * - Month: "month:yyyy-MM" (for Calendar Month view)
 */
type BoxOrderMap = Map<string, string[]>; // boxKey -> ordered task IDs

interface TaskStore {
  tasks: Task[];
  tasksByDate: TasksByDate;
  segmentsByTask: Map<string, TimeSegment[]>; // Cache segments by task ID
  boxOrder: BoxOrderMap; // Per-box ordering
  selectedDate: Date;
  loading: boolean;
  error: string | null;

  // Actions
  fetchTasks: () => Promise<void>;
  addTask: (task: Omit<Task, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => Promise<void>;
  createTask: (task: { title: string; planned_date: string } & Partial<Omit<Task, 'id' | 'user_id' | 'created_at' | 'updated_at'>>) => Promise<Task>;
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  setSelectedDate: (date: Date) => void;
  refreshSegments: () => Promise<void>; // Refresh segments cache
  
  // Task ordering actions (persistent, global order)
  reorderTasks: (taskIds: string[]) => Promise<void>; // Reorder tasks by their IDs array, persists to backend

  // Subtask ordering (scoped to one parent)
  reorderSubtasks: (parentTaskId: string, subtaskIds: string[]) => Promise<void>;
  
  // Legacy box ordering (deprecated, kept for backward compatibility during migration)
  reorderTasksInBox: (boxKey: string, taskIds: string[]) => void;
  getBoxKeyForDate: (date: Date) => string;
  getBoxKeyForWeek: (weekStart: Date) => string;
  getBoxKeyForMonth: (year: number, month: number) => string;
  applyBoxOrder: <T extends { id: string }>(items: T[], boxKey: string) => T[];

  // Computed
  getTasksForDate: (date: Date) => Task[];
  getDatesWithTasks: () => string[];
  getSubtasks: (parentId: string) => Task[];
}

/**
 * Group tasks by date according to "The Box" concept:
 * - If task has no segments: appears in planned_date box
 * - If task has segments: appears in all boxes where segments exist
 * - A task can appear in multiple boxes
 */
const groupTasksByDate = (tasks: Task[], segmentsByTask: Map<string, TimeSegment[]>): TasksByDate => {
  const grouped: TasksByDate = {};
  
  // Filter out subtasks - they should not appear in calendar/gantt/kanban views
  const mainTasks = tasks.filter((task) => !task.parent_task_id);
  
  mainTasks.forEach((task) => {
    const segments = segmentsByTask.get(task.id) || [];
    const segmentDates = new Set<string>();
    
    // Collect all dates from segments
    segments.forEach((segment) => {
      if (!segment.deleted_at) {
        const segmentDate = format(parseISO(segment.start_time), 'yyyy-MM-dd');
        segmentDates.add(segmentDate);
      }
    });
    
    // If task has segments, add to all boxes where segments exist
    if (segmentDates.size > 0) {
      segmentDates.forEach((dateKey) => {
        if (!grouped[dateKey]) {
          grouped[dateKey] = [];
        }
        // Avoid duplicates
        if (!grouped[dateKey].some(t => t.id === task.id)) {
          grouped[dateKey].push(task);
        }
      });
    } else {
      // If no segments, use planned_date (the default box)
      const dateToUse = task.planned_date || task.deadline;
      if (dateToUse) {
        const dateKey = format(parseISO(dateToUse), 'yyyy-MM-dd');
        if (!grouped[dateKey]) {
          grouped[dateKey] = [];
        }
        // Avoid duplicates
        if (!grouped[dateKey].some(t => t.id === task.id)) {
          grouped[dateKey].push(task);
        }
      }
    }
  });
  
  return grouped;
};

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  tasksByDate: {},
  segmentsByTask: new Map<string, TimeSegment[]>(),
  boxOrder: new Map<string, string[]>(),
  selectedDate: new Date(),
  loading: false,
  error: null,

  // Box ordering helpers
  getBoxKeyForDate: (date: Date) => {
    return `day:${format(date, 'yyyy-MM-dd')}`;
  },

  getBoxKeyForWeek: (weekStart: Date) => {
    return `week:${format(weekStart, 'yyyy-MM-dd')}`;
  },

  getBoxKeyForMonth: (year: number, month: number) => {
    return `month:${year}-${String(month + 1).padStart(2, '0')}`;
  },

  // Global task reordering - persists to backend with optimistic updates
  // taskIds: Array of task IDs in the desired order (from the sidebar drag operation)
  // This updates the global order field for these tasks
  // Strategy: Optimistic update first (smooth UX), then persist to backend
  reorderTasks: async (taskIds: string[]) => {
    if (taskIds.length === 0) return;
    
    const tasks = get().tasks;
    const api = getApiClient();
    
    // Get all main tasks (excluding subtasks and deleted tasks)
    const allMainTasks = tasks.filter(t => !t.parent_task_id && !t.deleted_at);
    
    // Create a map of reordered task IDs to their new positions
    const reorderedTaskPositions = new Map<string, number>();
    taskIds.forEach((id, index) => {
      reorderedTaskPositions.set(id, index);
    });
    
    // Split tasks into: reordered tasks (have new positions) and other tasks
    const reorderedTasks = allMainTasks.filter(t => reorderedTaskPositions.has(t.id));
    const otherTasks = allMainTasks.filter(t => !reorderedTaskPositions.has(t.id));
    
    // Handle edge case: if no reordered tasks found, return early
    if (reorderedTasks.length === 0) {
      console.warn('No reordered tasks found in task list');
      return;
    }
    
    // Sort other tasks by their current order
    otherTasks.sort((a, b) => a.order - b.order);
    
    // Build the complete new order:
    // 1. Tasks with order < min(reordered tasks) - keep before reordered section
    // 2. Reordered tasks - with new relative order
    // 3. Tasks with order > max(reordered tasks) - keep after reordered section
    
    const reorderedOrders = reorderedTasks.map(t => t.order);
    const minReorderedOrder = Math.min(...reorderedOrders);
    const maxReorderedOrder = Math.max(...reorderedOrders);
    
    const beforeTasks = otherTasks.filter(t => t.order < minReorderedOrder);
    const afterTasks = otherTasks.filter(t => t.order > maxReorderedOrder);
    
    // Build final ordered list
    const finalOrder: Task[] = [
      ...beforeTasks,
      ...taskIds.map(id => tasks.find(t => t.id === id)).filter(Boolean) as Task[],
      ...afterTasks
    ];
    
    // Calculate new order values: use consecutive integers starting from 0
    // This ensures clean, predictable ordering
    const orderMap = new Map<string, number>();
    for (let index = 0; index < finalOrder.length; index++) {
      const task = finalOrder[index];
      if (task) {
        orderMap.set(task.id, index);
      }
    }
    
    // OPTIMISTIC UPDATE: Update local state immediately for smooth UX
    const updatedTasks = tasks.map(task => {
      const newOrder = orderMap.get(task.id);
      if (newOrder !== undefined && task.order !== newOrder) {
        return { ...task, order: newOrder };
      }
      return task;
    });
    
    // Sort updated tasks by order
    updatedTasks.sort((a, b) => {
      if (a.order !== b.order) {
        return a.order - b.order;
      }
      const createdAtA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const createdAtB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return createdAtA - createdAtB;
    });
    
    // Update local state immediately (optimistic update)
    const segmentsByTask = get().segmentsByTask;
    const tasksByDate = groupTasksByDate(updatedTasks, segmentsByTask);
    set({ tasks: updatedTasks, tasksByDate });
    
    // Persist to backend in the background (without blocking UI)
    const updates: Array<Promise<Task>> = [];
    for (let index = 0; index < finalOrder.length; index++) {
      const task = finalOrder[index];
      if (task && task.order !== index) {
        updates.push(
          api.tasks.update(task.id, { order: index }) as Promise<Task>
        );
      }
    }
    
    // Batch update all tasks in background
    if (updates.length > 0) {
      Promise.all(updates).catch((error: any) => {
        console.error('Error updating task order:', error);
        // On error, refetch to sync with backend
        get().fetchTasks().catch(err => {
          console.error('Error refetching tasks after reorder failure:', err);
        });
      });
    }
  },

  reorderSubtasks: async (parentTaskId: string, subtaskIds: string[]) => {
    if (!parentTaskId || subtaskIds.length === 0) return;

    const api = getApiClient();
    const previousTasks = get().tasks;
    const segmentsByTask = get().segmentsByTask;

    // OPTIMISTIC UPDATE: apply new subtask order locally
    const newOrderIndex = new Map<string, number>();
    subtaskIds.forEach((id, index) => newOrderIndex.set(id, index));

    const updatedTasks = previousTasks.map((task) => {
      const index = newOrderIndex.get(task.id);
      if (index !== undefined && task.parent_task_id === parentTaskId) {
        return { ...task, order: index };
      }
      return task;
    });

    // tasksByDate only includes main tasks, but keep it consistent via shared grouper
    const updatedTasksByDate = groupTasksByDate(updatedTasks, segmentsByTask);
    set({ tasks: updatedTasks, tasksByDate: updatedTasksByDate });

    try {
      // Persist sequentially to avoid write races
      for (let index = 0; index < subtaskIds.length; index++) {
        const id = subtaskIds[index];
        await api.tasks.update(id, { order: index });
      }
    } catch (error) {
      // ROLLBACK on failure
      const rollbackTasksByDate = groupTasksByDate(previousTasks, segmentsByTask);
      set({ tasks: previousTasks, tasksByDate: rollbackTasksByDate });
      throw error;
    }
  },

  // Legacy box ordering (deprecated - kept for compatibility, will be removed)
  reorderTasksInBox: (boxKey: string, taskIds: string[]) => {
    const boxOrder = new Map(get().boxOrder);
    boxOrder.set(boxKey, taskIds);
    set({ boxOrder });
    
    // Note: This is in-memory only. For persistent ordering, use reorderTasks() instead.
  },

  applyBoxOrder: <T extends { id: string }>(items: T[], boxKey: string): T[] => {
    const order = get().boxOrder.get(boxKey);
    if (!order || order.length === 0) {
      return items; // No stored order, return as-is
    }

    // Create a map of items by ID for fast lookup
    const itemsMap = new Map(items.map(item => [item.id, item]));
    
    // Create ordered array following the stored order
    const ordered: T[] = [];
    const seen = new Set<string>();
    
    // First, add items in the stored order
    for (const taskId of order) {
      if (itemsMap.has(taskId)) {
        ordered.push(itemsMap.get(taskId)!);
        seen.add(taskId);
      }
    }
    
    // Then, add any items not in the stored order (new tasks)
    for (const item of items) {
      if (!seen.has(item.id)) {
        ordered.push(item);
      }
    }
    
    return ordered;
  },

  fetchTasks: async () => {
    set({ loading: true, error: null });
    try {
      const api = getApiClient();
      const tasks = await api.tasks.getAll() as Task[];
      
      // Fetch all segments to build the segmentsByTask map
      const allSegments = await api.timeSegments.getAll() as TimeSegment[];
      const segmentsByTask = new Map<string, TimeSegment[]>();

      // Single Source of Truth: tasks are authoritative.
      // Only keep segments that belong to tasks that still exist.
      const activeTaskIds = new Set(tasks.filter(t => !t.deleted_at).map(t => t.id));
      
      // Group segments by task_id
      allSegments.forEach((segment) => {
        if (!segment.deleted_at && activeTaskIds.has(segment.task_id)) {
          const existing = segmentsByTask.get(segment.task_id) || [];
          segmentsByTask.set(segment.task_id, [...existing, segment]);
        }
      });
      
      // Sort tasks by order field to ensure consistent ordering
      tasks.sort((a, b) => {
        if (a.order !== b.order) {
          return a.order - b.order;
        }
        // Fallback: createdAt for stable ordering
        const createdAtA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const createdAtB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return createdAtA - createdAtB;
      });
      
      const tasksByDate = groupTasksByDate(tasks, segmentsByTask);
      
      set({ tasks, tasksByDate, segmentsByTask, loading: false });
    } catch (error: any) {
      console.error('Error fetching tasks:', error);
      set({ 
        error: error.message || 'Failed to fetch tasks', 
        loading: false,
        tasks: [],
        tasksByDate: {},
        segmentsByTask: new Map()
      });
    }
  },

  refreshSegments: async () => {
    try {
      const api = getApiClient();
      const allSegments = await api.timeSegments.getAll() as TimeSegment[];
      const segmentsByTask = new Map<string, TimeSegment[]>();

      const activeTaskIds = new Set(get().tasks.filter(t => !t.deleted_at).map(t => t.id));
      
      // Group segments by task_id
      allSegments.forEach((segment) => {
        if (!segment.deleted_at && activeTaskIds.has(segment.task_id)) {
          const existing = segmentsByTask.get(segment.task_id) || [];
          segmentsByTask.set(segment.task_id, [...existing, segment]);
        }
      });
      
      const tasks = get().tasks;
      const tasksByDate = groupTasksByDate(tasks, segmentsByTask);
      
      set({ segmentsByTask, tasksByDate });
    } catch (error: any) {
      console.error('Error refreshing segments:', error);
    }
  },

  addTask: async (taskData) => {
    try {
      const api = getApiClient();
      const newTask = await api.tasks.create(taskData) as Task;
      const tasks = [...get().tasks, newTask];
      const segmentsByTask = get().segmentsByTask;
      const tasksByDate = groupTasksByDate(tasks, segmentsByTask);
      
      set({ tasks, tasksByDate });
    } catch (error: any) {
      console.error('Error adding task:', error);
      set({ error: error.message });
      throw error;
    }
  },

  createTask: async (taskData) => {
    try {
      const api = getApiClient();
      const newTask = await api.tasks.create(taskData) as Task;

      const tasks = [...get().tasks, newTask];
      const segmentsByTask = get().segmentsByTask;
      const tasksByDate = groupTasksByDate(tasks, segmentsByTask);
      set({ tasks, tasksByDate });

      return newTask;
    } catch (error: any) {
      console.error('Error creating task:', error);
      set({ error: error.message });
      throw error;
    }
  },

  updateTask: async (id, updates) => {
    try {
      const api = getApiClient();
      const updated = await api.tasks.update(id, updates) as Task;
      
      const tasks = get().tasks.map((task) =>
        task.id === id ? updated : task
      );
      const segmentsByTask = get().segmentsByTask;
      const tasksByDate = groupTasksByDate(tasks, segmentsByTask);
      
      set({ tasks, tasksByDate });

      // ✅ ONE-WAY SYNC: Task completed → All segments completed
      if (updates.status === 'completed') {
        const { useDailyGanttStore } = await import('./dailyGanttStore');
        await useDailyGanttStore.getState().syncTaskToSegments(id);
        // Refresh segments after sync
        await get().refreshSegments();
      }

      // ✅ TITLE SYNC: Update segments with titleIsCustom = false
      if (updates.title) {
        const { useDailyGanttStore } = await import('./dailyGanttStore');
        const segments = useDailyGanttStore.getState().getSegmentsForTask(id);
        for (const segment of segments) {
          if (!segment.title_is_custom) {
            await useDailyGanttStore.getState().updateSegment(segment.id, {
              title: updates.title,
            });
          }
        }
      }
    } catch (error: any) {
      console.error('Error updating task:', error);
      set({ error: error.message });
      throw error;
    }
  },

  deleteTask: async (id) => {
    try {
      const api = getApiClient();
      await api.tasks.delete(id);

      const tasks = get().tasks.filter((task) => task.id !== id);
      const segmentsByTask = get().segmentsByTask;
      segmentsByTask.delete(id); // Remove segments for deleted task
      const tasksByDate = groupTasksByDate(tasks, segmentsByTask);
      
      set({ tasks, tasksByDate, segmentsByTask });

      // Refresh Gantt/day view (selected date) and Calendar to remove lingering bars
      try {
        const { useDailyGanttStore } = await import('./dailyGanttStore');
        const gantt = useDailyGanttStore.getState();
        if (gantt?.selectedDate) {
          await gantt.fetchSegmentsForDate(gantt.selectedDate);
        }
      } catch (err) {
        console.warn('Failed to refresh Gantt after task delete:', err);
      }

      try {
        const { useCalendarStore } = await import('./calendarStore');
        const calendar = useCalendarStore.getState();
        // Refresh the exact range the Calendar last fetched, so deletions reflect immediately
        // even when the user is viewing a non-default range.
        if (calendar.lastFetchedRange) {
          await calendar.fetchEvents(calendar.lastFetchedRange.start, calendar.lastFetchedRange.end);
        } else {
          const now = new Date();
          const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          const end = new Date(now.getFullYear(), now.getMonth() + 2, 0);
          await calendar.fetchEvents(start, end);
        }
      } catch (err) {
        console.warn('Failed to refresh calendar after task delete:', err);
      }
    } catch (error: any) {
      console.error('Error deleting task:', error);
      set({ error: error.message });
      throw error;
    }
  },

  setSelectedDate: (date) => {
    set({ selectedDate: date });
  },

  getTasksForDate: (date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    const tasks = get().tasksByDate[dateKey] || [];
    // Filter out subtasks (double-check, though they should already be filtered in groupTasksByDate)
    const mainTasks = tasks.filter((task) => !task.parent_task_id);
    
    // Sort by global order field (primary), then by createdAt as fallback
    return mainTasks.sort((a, b) => {
      // Primary: order field (user-defined manual ordering)
      if (a.order !== b.order) {
        return a.order - b.order;
      }
      // Fallback: createdAt for stable ordering among tasks with same order
      const createdAtA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const createdAtB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return createdAtA - createdAtB;
    });
  },

  getDatesWithTasks: () => {
    return Object.keys(get().tasksByDate);
  },

  getSubtasks: (parentId) => {
    return get().tasks.filter((task) => task.parent_task_id === parentId);
  },
}));

