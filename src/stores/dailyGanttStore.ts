import { create } from 'zustand';
import { getApiClient } from '@/lib/clerk-api';
import { format, parseISO, differenceInMinutes, addHours, addMinutes, startOfToday, addDays, isSameDay } from 'date-fns';
import { Task, useTaskStore } from './taskStore';
import { TimeSegment } from '@/types/timeSegment';
import { getTaskBoxDates, normalizeToDate } from '@/utils/taskBoxUtils';

interface DailyGanttStore {
  selectedDate: Date;
  segments: TimeSegment[];
  tasks: Task[];
  loading: boolean;
  error: string | null;
  expandedTaskIds: Set<string>;
  selectedSegmentIds: Set<string>; // For multi-select

  // Actions
  setSelectedDate: (date: Date) => void;
  fetchSegmentsForDate: (date: Date) => Promise<void>;
  createSegment: (segment: Omit<TimeSegment, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => Promise<void>;
  createSegmentFromDrop: (taskId: string, startTime: Date) => Promise<void>; // Silent creation, 1-hour default
  updateSegment: (id: string, updates: Partial<TimeSegment>) => Promise<void>;
  deleteSegment: (id: string) => Promise<void>; // Soft delete
  bulkDeleteSegments: (ids: string[]) => Promise<void>;
  bulkUpdateSegments: (ids: string[], updates: Partial<TimeSegment>) => Promise<void>;
  toggleTaskExpanded: (taskId: string) => void;
  toggleSegmentSelection: (id: string) => void;
  clearSegmentSelection: () => void;

  // Task reordering
  reorderTasks: (sourceIndex: number, destIndex: number) => Promise<void>;

  // Sync
  syncTaskToSegments: (taskId: string) => Promise<void>; // One-way: Task completed → segments completed
  calculateScheduledTime: (taskId: string) => number; // Auto-calculate from segments

  // Computed
  getSegmentsForDate: (date: Date) => TimeSegment[];
  getDatesWithSegments: () => string[];
  getSegmentsForTask: (taskId: string) => TimeSegment[];
  getSegmentsForDateGroupedByTask: (date: Date) => Record<string, TimeSegment[]>;
  getGanttRows: (date: Date) => Array<{
    taskId: string;
    task: Task;
    segments: TimeSegment[];
    subtasks?: Array<{ task: Task; segments: TimeSegment[] }>;
  }>;
}

export const useDailyGanttStore = create<DailyGanttStore>((set, get) => ({
  selectedDate: new Date(),
  segments: [],
  tasks: [],
  loading: false,
  error: null,
  expandedTaskIds: new Set<string>(),
  selectedSegmentIds: new Set<string>(),

  setSelectedDate: (date) => {
    set({ selectedDate: date });
    get().fetchSegmentsForDate(date);
  },

  fetchSegmentsForDate: async (date) => {
    set({ loading: true, error: null });
    try {
      const api = getApiClient();
      const dateStr = format(date, 'yyyy-MM-dd');
      const data = await api.timeSegments.getByDate(dateStr) as TimeSegment[];
      // Filter out soft-deleted segments
      const activeSegments = data.filter(s => !s.deleted_at);
      // Sort by start_time
      activeSegments.sort((a, b) => 
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      );

      set({ segments: activeSegments, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  createSegment: async (segmentData) => {
    try {
      const api = getApiClient();

      // Calculate order (session number) for this task on this date
      const existingSegments = get().segments.filter(
        (s) => s.task_id === segmentData.task_id && s.date === segmentData.date
      );
      const order = existingSegments.length + 1;

      // Calculate duration if not provided
      const start = parseISO(segmentData.start_time);
      const end = parseISO(segmentData.end_time);
      const duration = differenceInMinutes(end, start);

      const newSegment = await api.timeSegments.create({
        ...segmentData,
        order,
        duration,
      }) as TimeSegment;

      const segments = [...get().segments, newSegment];
      set({ segments });

      // Update task's scheduled_time
      await get().updateTaskScheduledTime(segmentData.task_id);

      // Refresh calendar events to sync
      try {
        const { useCalendarStore } = await import('./calendarStore');
        const calendarStore = useCalendarStore.getState();
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 2, 0);
        await calendarStore.fetchEvents(start, end);
      } catch (error) {
        console.warn('Failed to refresh calendar after segment creation:', error);
      }

      // Refresh task store to update "The Box" grouping
      try {
        await useTaskStore.getState().refreshSegments();
      } catch (error) {
        console.warn('Failed to refresh task store after segment creation:', error);
      }
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },

  createSegmentFromDrop: async (taskId, startTime) => {
    // Silent creation with 1-hour default duration
    const endTime = addHours(startTime, 1);
    const { tasks } = useTaskStore.getState();
    const task = tasks.find((t) => t.id === taskId);
    
    await get().createSegment({
      task_id: taskId,
      title: task?.title || 'Untitled',
      title_is_custom: false,
      date: format(startTime, 'yyyy-MM-dd'),
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      duration: 60, // 1 hour
      status: 'planned',
      order: 1, // Will be recalculated
      source: 'app',
    });
  },

  updateSegment: async (id, updates) => {
    try {
      // Find the segment to update (may not be in local store if from Calendar)
      let segment = get().segments.find((s) => s.id === id);
      
      // If segment not in local store, try to get it from the API first
      // This can happen when Calendar updates a segment that's not in Daily Gantt's current date
      if (!segment) {
        try {
          const api = getApiClient();
          // Try to get all segments and find the one we need
          const allSegments = await api.timeSegments.getAll() as TimeSegment[];
          segment = allSegments.find((s) => s.id === id && !s.deleted_at);
          
          if (segment) {
            // Add to local store if found
            set((state) => {
              if (!state.segments.find((s) => s.id === id)) {
                return { segments: [...state.segments, segment!] };
              }
              return state;
            });
          }
        } catch (error) {
          // If fetch fails, we'll proceed with the update anyway
          // The API will validate the segment exists
          console.warn(`Segment ${id} not in local store, will update via API directly`);
        }
      }

      // Recalculate duration if times changed
      let duration: number;
      if (updates.start_time || updates.end_time) {
        const start = parseISO(updates.start_time || segment?.start_time || new Date().toISOString());
        const end = parseISO(updates.end_time || segment?.end_time || new Date().toISOString());
        duration = differenceInMinutes(end, start);
        updates.duration = duration;
      } else {
        duration = segment?.duration || 0;
      }

      // OPTIMISTIC UPDATE: Update store immediately before API call (if segment exists in store)
      let optimisticUpdated: TimeSegment | null = null;
      if (segment) {
        optimisticUpdated = {
          ...segment,
          ...updates,
          duration,
          updated_at: new Date().toISOString(),
        };

        // Update store immediately for instant UI feedback
        set((state) => ({
          segments: state.segments.map((s) =>
            s.id === id ? optimisticUpdated! : s
          ),
        }));
      }

      // Fire API call in background (don't await before continuing)
      const api = getApiClient();
      const apiPromise = api.timeSegments.update(id, updates) as Promise<TimeSegment>;

      // Update task's scheduled_time in background (if we have segment data)
      if (optimisticUpdated && optimisticUpdated.task_id) {
        const taskId = optimisticUpdated.task_id;
        // Recalculate scheduled time optimistically
        const taskSegments = get().segments
          .filter((s) => s.task_id === taskId && s.id !== id && !s.deleted_at)
          .concat([optimisticUpdated]);
        const newScheduledTime = taskSegments.reduce((sum, s) => sum + (s.duration || 0), 0);
        
        // Update task store optimistically
        try {
          const { useTaskStore } = await import('./taskStore');
          const taskStore = useTaskStore.getState();
          const task = taskStore.tasks.find((t) => t.id === taskId);
          if (task) {
            // Optimistically update task's scheduled_time
            taskStore.updateTask(taskId, { scheduled_time: newScheduledTime });
          }
        } catch (error) {
          console.warn('Error optimistically updating task scheduled_time:', error);
        }
      }

      // Wait for API response and update with server data (which should match our optimistic update)
      const updated = await apiPromise;

      // Update store with server response (should match optimistic, but ensures consistency)
      set((state) => {
        const existingIndex = state.segments.findIndex((s) => s.id === id);
        if (existingIndex >= 0) {
          // Update existing segment
          const newSegments = [...state.segments];
          newSegments[existingIndex] = updated;
          return { segments: newSegments };
        } else {
          // Add new segment if it wasn't in store before
          return { segments: [...state.segments, updated] };
        }
      });

      // Update task's scheduled_time from server
      const updatedSegment = get().segments.find((s) => s.id === id) || updated;
      if (updatedSegment && updatedSegment.task_id) {
        await get().updateTaskScheduledTime(updatedSegment.task_id);
      }

      // Refresh taskStore to update box membership (in background, don't block)
      Promise.all([
        useTaskStore.getState().refreshSegments().catch(err => 
          console.warn('Error refreshing task store after segment update:', err)
        ),
        (async () => {
          try {
            const { useCalendarStore } = await import('./calendarStore');
            const calendarStore = useCalendarStore.getState();
            const now = new Date();
            const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const end = new Date(now.getFullYear(), now.getMonth() + 2, 0);
            await calendarStore.fetchEvents(start, end);
          } catch (error) {
            console.warn('Failed to refresh calendar after segment update:', error);
          }
        })(),
      ]).catch(() => {
        // Background sync errors are non-critical
      });
    } catch (error: any) {
      // On error, revert optimistic update by re-fetching
      const segment = get().segments.find((s) => s.id === id);
      if (segment) {
        // Re-fetch the affected date to get correct data
        const segmentDate = format(parseISO(segment.start_time), 'yyyy-MM-dd');
        get().fetchSegmentsForDate(parseISO(segmentDate));
      }
      set({ error: error.message });
      throw error;
    }
  },

  deleteSegment: async (id) => {
    try {
      // Soft delete via API
      const api = getApiClient();
      await api.timeSegments.delete(id);

      const segment = get().segments.find((s) => s.id === id);
      const segments = get().segments.filter((segment) => segment.id !== id);
      set({ segments });

      // Update task's scheduled_time
      if (segment) {
        await get().updateTaskScheduledTime(segment.task_id);
      }

      // Refresh calendar events to sync
      try {
        const { useCalendarStore } = await import('./calendarStore');
        const calendarStore = useCalendarStore.getState();
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 2, 0);
        await calendarStore.fetchEvents(start, end);
      } catch (error) {
        console.warn('Failed to refresh calendar after segment deletion:', error);
      }

      // Refresh task store to update "The Box" grouping (Work Time Blocks determine box membership)
      try {
        await useTaskStore.getState().refreshSegments();
      } catch (error) {
        console.warn('Failed to refresh task store after segment deletion:', error);
      }
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },

  bulkDeleteSegments: async (ids) => {
    try {
      // Delete all segments via API
      const api = getApiClient();
      await Promise.all(ids.map(id => api.timeSegments.delete(id)));

      const segments = get().segments.filter((segment) => !ids.includes(segment.id));
      set({ segments });

      // Update all affected tasks
      const affectedTaskIds = new Set(
        get().segments
          .filter((s) => ids.includes(s.id))
          .map((s) => s.task_id)
      );

      await Promise.all(
        Array.from(affectedTaskIds).map((taskId) =>
          get().updateTaskScheduledTime(taskId)
        )
      );

      // Refresh task store to update "The Box" grouping
      try {
        await useTaskStore.getState().refreshSegments();
      } catch (error) {
        console.warn('Failed to refresh task store after bulk segment deletion:', error);
      }
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },

  bulkUpdateSegments: async (ids, updates) => {
    try {
      // Update all segments via API
      const api = getApiClient();
      await Promise.all(ids.map(id => api.timeSegments.update(id, updates)));

      // Refresh segments from API to get updated data
      const currentDate = get().selectedDate;
      await get().fetchSegmentsForDate(currentDate);

      // Update all affected tasks
      const affectedTaskIds = new Set(
        get().segments
          .filter((s) => ids.includes(s.id))
          .map((s) => s.task_id)
      );

      await Promise.all(
        Array.from(affectedTaskIds).map((taskId) =>
          get().updateTaskScheduledTime(taskId)
        )
      );

      // Refresh task store to update "The Box" grouping
      try {
        await useTaskStore.getState().refreshSegments();
      } catch (error) {
        console.warn('Failed to refresh task store after bulk segment update:', error);
      }
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },

  toggleTaskExpanded: (taskId) => {
    const expanded = new Set(get().expandedTaskIds);
    if (expanded.has(taskId)) {
      expanded.delete(taskId);
    } else {
      expanded.add(taskId);
    }
    set({ expandedTaskIds: expanded });
  },

  getSegmentsForDate: (date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    return get().segments.filter((segment) => {
      const segmentDate = format(parseISO(segment.start_time), 'yyyy-MM-dd');
      return segmentDate === dateKey;
    });
  },

  getDatesWithSegments: () => {
    const dates = new Set(
      get().segments.map((segment) =>
        format(parseISO(segment.start_time), 'yyyy-MM-dd')
      )
    );
    return Array.from(dates);
  },

  getSegmentsForTask: (taskId) => {
    return get().segments.filter((segment) => segment.task_id === taskId);
  },

  getSegmentsForDateGroupedByTask: (date) => {
    const segmentsForDate = get().getSegmentsForDate(date);
    const grouped: Record<string, TimeSegment[]> = {};
    
    segmentsForDate.forEach((segment) => {
      if (!grouped[segment.task_id]) {
        grouped[segment.task_id] = [];
      }
      grouped[segment.task_id].push(segment);
    });
    
    return grouped;
  },

  toggleSegmentSelection: (id) => {
    const selected = new Set(get().selectedSegmentIds);
    if (selected.has(id)) {
      selected.delete(id);
    } else {
      selected.add(id);
    }
    set({ selectedSegmentIds: selected });
  },

  clearSegmentSelection: () => {
    set({ selectedSegmentIds: new Set() });
  },

  reorderTasks: async (sourceIndex, destIndex) => {
    const { 
      selectedDate, 
      getGanttRows 
    } = get();
    
    // Get current tasks for the selected date (already filtered and sorted)
    const currentRows = getGanttRows(selectedDate);
    
    // Reorder the rows
    const reordered = Array.from(currentRows);
    const [removed] = reordered.splice(sourceIndex, 1);
    reordered.splice(destIndex, 0, removed);
    
    // Extract task IDs in new order
    const taskIds = reordered.map(row => row.taskId);
    
    // Update global task order and persist to backend
    // This ensures the order is consistent across all views (Calendar, Daily Gantt, Monthly Gantt)
    const taskStore = useTaskStore.getState();
    try {
      await taskStore.reorderTasks(taskIds);
    } catch (error) {
      console.error('Failed to update task order:', error);
      throw error;
    }
  },

  syncTaskToSegments: async (taskId) => {
    try {
      // One-way sync: If task is completed, mark all segments as completed
      const { tasks } = useTaskStore.getState();
      const task = tasks.find((t) => t.id === taskId);
      if (!task || task.status !== 'completed') return;

      const segments = get().segments.filter((s) => s.task_id === taskId);
      await Promise.all(
        segments.map((segment) =>
          get().updateSegment(segment.id, { status: 'completed' })
        )
      );
    } catch (error) {
      console.error('Error syncing task to segments:', error);
    }
  },

  calculateScheduledTime: (taskId) => {
    const segments = get().segments.filter(
      (s) => s.task_id === taskId && !s.deleted_at
    );
    return segments.reduce((sum, s) => sum + (s.duration || 0), 0);
  },

  updateTaskScheduledTime: async (taskId) => {
    const scheduledTime = get().calculateScheduledTime(taskId);
    const { updateTask } = useTaskStore.getState();
    await updateTask(taskId, { scheduled_time: scheduledTime });
  },

  getGanttRows: (date) => {
    const { tasks, segmentsByTask } = useTaskStore.getState();
    const dateKey = format(date, 'yyyy-MM-dd');
    
    // Filter tasks by box dates: only show tasks whose box dates include the selected date
    const tasksForDay = tasks.filter((task) => {
      // Skip subtasks
      if (task.parent_task_id || task.deleted_at) {
        return false;
      }
      
      // Skip completed tasks
      if (task.status === 'completed') {
        return false;
      }
      
      // Get box dates for this task
      const boxDates = getTaskBoxDates(task, segmentsByTask);
      
      // Check if any box date matches the selected date
      return boxDates.some(boxDate => isSameDay(boxDate, date));
    });
    
    // Sort by global order field (primary), then by createdAt as fallback
    // This ensures consistent ordering across all views (Calendar, Daily Gantt, Monthly Gantt)
    const sortedTasks = tasksForDay.sort((a, b) => {
      // Primary: order field (user-defined manual ordering from drag & drop)
      if (a.order !== b.order) {
        return a.order - b.order;
      }
      // Fallback: createdAt for stable ordering among tasks with same order
      const createdAtA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const createdAtB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return createdAtA - createdAtB;
    });

    // Get all segments for this date
    const segmentsForDate = get().segments.filter((s) => {
      const segmentDate = format(parseISO(s.start_time), 'yyyy-MM-dd');
      return segmentDate === dateKey && !s.deleted_at;
    });

    // Build rows with perfect 1:1 alignment
    return sortedTasks.map((task) => {
      const taskSegments = segmentsForDate
        .filter((s) => s.task_id === task.id)
        .sort((a, b) => a.order - b.order);

      return {
        taskId: task.id,
        task,
        segments: taskSegments,
        subtasks: undefined, // Subtasks are not displayed in Daily Gantt
      };
    });
  },

  // Context menu actions
  duplicateSegment: async (id) => {
    try {
      const segment = get().segments.find((s) => s.id === id);
      if (!segment) return;

      const start = parseISO(segment.start_time);
      const end = parseISO(segment.end_time);
      const duration = differenceInMinutes(end, start);

      // Create duplicate 1 hour later
      const newStart = addMinutes(start, 60);
      const newEnd = addMinutes(end, 60);

      await get().createSegment({
        task_id: segment.task_id,
        title: segment.title,
        title_is_custom: segment.title_is_custom,
        date: format(newStart, 'yyyy-MM-dd'),
        start_time: newStart.toISOString(),
        end_time: newEnd.toISOString(),
        duration,
        status: segment.status,
        description: segment.description,
        notes: segment.notes,
        color: segment.color,
        tags: segment.tags,
        source: segment.source,
      });
    } catch (error) {
      console.error('Error duplicating segment:', error);
    }
  },

  moveSegmentToToday: async (id) => {
    const segment = get().segments.find((s) => s.id === id);
    if (!segment) return;

    const start = parseISO(segment.start_time);
    const end = parseISO(segment.end_time);
    const today = startOfToday();
    
    // Preserve time of day
    const newStart = new Date(today);
    newStart.setHours(start.getHours(), start.getMinutes(), 0, 0);
    
    const duration = differenceInMinutes(end, start);
    const newEnd = addMinutes(newStart, duration);

    await get().updateSegment(id, {
      date: format(newStart, 'yyyy-MM-dd'),
      start_time: newStart.toISOString(),
      end_time: newEnd.toISOString(),
    });
  },

  moveSegmentToTomorrow: async (id) => {
    const segment = get().segments.find((s) => s.id === id);
    if (!segment) return;

    const start = parseISO(segment.start_time);
    const end = parseISO(segment.end_time);
    const tomorrow = addDays(startOfToday(), 1);
    
    // Preserve time of day
    const newStart = new Date(tomorrow);
    newStart.setHours(start.getHours(), start.getMinutes(), 0, 0);
    
    const duration = differenceInMinutes(end, start);
    const newEnd = addMinutes(newStart, duration);

    await get().updateSegment(id, {
      date: format(newStart, 'yyyy-MM-dd'),
      start_time: newStart.toISOString(),
      end_time: newEnd.toISOString(),
    });
  },

  splitSegment: async (id) => {
    const segment = get().segments.find((s) => s.id === id);
    if (!segment) return;

    const start = parseISO(segment.start_time);
    const end = parseISO(segment.end_time);
    const midpoint = new Date((start.getTime() + end.getTime()) / 2);

    // Create first segment
    await get().createSegment({
      task_id: segment.task_id,
      title: segment.title,
      title_is_custom: segment.title_is_custom,
      date: segment.date,
      start_time: start.toISOString(),
      end_time: midpoint.toISOString(),
      duration: differenceInMinutes(midpoint, start),
      status: segment.status,
      description: segment.description,
      notes: segment.notes,
      color: segment.color,
      tags: segment.tags,
      source: segment.source,
      order: segment.order,
    });

    // Create second segment
    await get().createSegment({
      task_id: segment.task_id,
      title: segment.title,
      title_is_custom: segment.title_is_custom,
      date: segment.date,
      start_time: midpoint.toISOString(),
      end_time: end.toISOString(),
      duration: differenceInMinutes(end, midpoint),
      status: segment.status,
      description: segment.description,
      notes: segment.notes,
      color: segment.color,
      tags: segment.tags,
      source: segment.source,
      order: segment.order + 1,
    });

    // Delete original
    await get().deleteSegment(id);
  },

  deleteAllSegmentsForTask: async (taskId) => {
    const segments = get().segments.filter((s) => s.task_id === taskId && !s.deleted_at);
    await get().bulkDeleteSegments(segments.map((s) => s.id));
  },
}));

