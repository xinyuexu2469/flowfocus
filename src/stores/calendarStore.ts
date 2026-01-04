import { create } from 'zustand';
import { getApiClient } from '@/lib/clerk-api';
import { TimeSegment } from './dailyGanttStore';
import { format } from 'date-fns';

export interface CalendarEvent {
  id: string;
  taskId?: string;
  googleEventId?: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  allDay: boolean;
  location?: string;
  source: 'app' | 'google';
}

interface CalendarStore {
  events: CalendarEvent[];
  lastFetchedRange: { start: Date; end: Date } | null;
  googleCalendarConnected: boolean;
  visibleCalendars: string[];
  loading: boolean;
  error: string | null;

  // Actions
  fetchEvents: (start: Date, end: Date) => Promise<void>;
  refreshLastFetchedRange: () => Promise<void>;
  createEvent: (event: Omit<CalendarEvent, 'id'>) => Promise<void>;
  updateEvent: (id: string, updates: Partial<CalendarEvent>) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  connectGoogleCalendar: () => Promise<void>;
  syncWithGoogleCalendar: () => Promise<void>;
}

export const useCalendarStore = create<CalendarStore>((set, get) => ({
  events: [],
  lastFetchedRange: null,
  googleCalendarConnected: false,
  visibleCalendars: ['primary'],
  loading: false,
  error: null,

  refreshLastFetchedRange: async () => {
    const range = get().lastFetchedRange;
    if (!range) return;
    await get().fetchEvents(range.start, range.end);
  },

  fetchEvents: async (start, end) => {
    set({ loading: true, error: null });
    try {
      const api = getApiClient();

      // Fetch segments for all days in range in PARALLEL (not sequential)
      const dateRange: string[] = [];
      const currentDate = new Date(start);
      while (currentDate <= end) {
        dateRange.push(format(currentDate, 'yyyy-MM-dd'));
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Parallel fetch all dates at once (much faster)
      const results = await Promise.allSettled(
        dateRange.map(dateStr => api.timeSegments.getByDate(dateStr))
      );

      const allSegments: any[] = [];
      for (const result of results) {
        if (result.status === 'fulfilled') {
          const segments = result.value as any[];
          allSegments.push(...segments.filter(s => !s.deleted_at));
        }
        // Ignore failed dates
      }

      // Optional: If tasks are already loaded, hide segments linked to missing tasks.
      // This keeps Calendar consistent with task deletion even if segments lag behind.
      let activeTaskIds: Set<string> | null = null;
      try {
        const { useTaskStore } = await import('./taskStore');
        const tasks = useTaskStore.getState().tasks;
        if (tasks.length > 0) {
          activeTaskIds = new Set(tasks.filter(t => !t.deleted_at).map(t => t.id));
        }
      } catch {
        // Ignore – calendar can still function without task filtering
      }

      // Build events without fetching individual tasks (use segment.title)
      const events: CalendarEvent[] = allSegments
        .filter(segment => {
          // Keep custom (no task) events always. If tasks are loaded, hide orphaned task segments.
          if (!segment.task_id) return true;
          if (!activeTaskIds) return true;
          return activeTaskIds.has(segment.task_id);
        })
        .filter(segment => {
          const segmentStart = new Date(segment.start_time);
          return segmentStart >= start && segmentStart <= end;
        })
        .map(segment => ({
          id: segment.id,
          taskId: segment.task_id || undefined,
          googleEventId: segment.google_calendar_event_id || undefined,
          title: segment.title || 'Untitled',
          description: segment.description || segment.notes || undefined,
          startTime: new Date(segment.start_time),
          endTime: new Date(segment.end_time),
          allDay: false,
          location: undefined,
          source: segment.source || 'app',
        }));

      // Sort by start time
      events.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

      set({ events, loading: false, lastFetchedRange: { start, end } });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  createEvent: async (eventData) => {
    try {

      // Use dailyGanttStore to create segment (unified with Daily Gantt)
      const { useDailyGanttStore } = await import('./dailyGanttStore');
      const dailyStore = useDailyGanttStore.getState();

      // Get task title if not provided
      let title = eventData.title;
      if (!title && eventData.taskId) {
        try {
          const api = getApiClient();
          const taskData = await api.tasks.getById(eventData.taskId);
          title = taskData?.title || 'Untitled Task';
        } catch (error) {
          title = 'Untitled Task';
        }
      }

      // Calculate duration
      const duration = Math.round(
        (eventData.endTime.getTime() - eventData.startTime.getTime()) / 60000
      );

      // Get order (session number)
      const existingSegments = eventData.taskId 
        ? dailyStore.getSegmentsForTask(eventData.taskId)
        : [];
      const order = existingSegments.length + 1;

      // Create time segment
      await dailyStore.createSegment({
        task_id: eventData.taskId || null,
        title: title || 'Untitled Event',
        title_is_custom: !eventData.taskId, // Custom if no task linked
        date: format(eventData.startTime, 'yyyy-MM-dd'),
        start_time: eventData.startTime.toISOString(),
        end_time: eventData.endTime.toISOString(),
        duration,
        status: 'planned',
        order,
        description: eventData.description || null,
        notes: eventData.description || null,
        source: eventData.source || 'app',
      });

      // Refresh events (range-aware)
      const range = get().lastFetchedRange;
      if (range) {
        await get().fetchEvents(range.start, range.end);
      } else {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 2, 0);
        await get().fetchEvents(start, end);
      }

      // Refresh Daily Gantt for the affected date
      try {
        const { useDailyGanttStore } = await import('./dailyGanttStore');
        const dailyStore = useDailyGanttStore.getState();
        const eventDate = eventData.startTime;
        await dailyStore.fetchSegmentsForDate(eventDate);
      } catch (error) {
        console.warn('Failed to refresh Daily Gantt after calendar event creation:', error);
      }
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },

  updateEvent: async (id, updates) => {
    try {
      // Find the event to update
      const event = get().events.find((e) => e.id === id);
      if (!event) {
        throw new Error(`Event ${id} not found`);
      }

      // OPTIMISTIC UPDATE: Update events immediately
      const optimisticUpdated: CalendarEvent = {
        ...event,
        ...updates,
      };

      set((state) => ({
        events: state.events.map((e) =>
          e.id === id ? optimisticUpdated : e
        ),
      }));

      // Use dailyGanttStore to update segment (unified with Daily Gantt)
      const { useDailyGanttStore } = await import('./dailyGanttStore');
      const dailyStore = useDailyGanttStore.getState();

      const updateData: any = {};
      
      if (updates.startTime) {
        updateData.start_time = updates.startTime.toISOString();
        updateData.date = format(updates.startTime, 'yyyy-MM-dd');
      }
      if (updates.endTime) {
        updateData.end_time = updates.endTime.toISOString();
      }
      if (updates.description !== undefined) {
        updateData.description = updates.description;
        updateData.notes = updates.description;
      }
      if (updates.taskId !== undefined) {
        updateData.task_id = updates.taskId || null;
      }

      // Recalculate duration if times changed
      if (updates.startTime || updates.endTime) {
        const start = updates.startTime || event.startTime;
        const end = updates.endTime || event.endTime;
        updateData.duration = Math.round((end.getTime() - start.getTime()) / 60000);
      }

      // Update segment in database (this also updates dailyGanttStore optimistically)
      await dailyStore.updateSegment(id, updateData);

      // Refresh events in background (don't block, and merge with optimistic update)
      Promise.all([
        (async () => {
          try {
            const range = get().lastFetchedRange;
            if (range) {
              await get().fetchEvents(range.start, range.end);
            } else {
              const now = new Date();
              const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
              const end = new Date(now.getFullYear(), now.getMonth() + 2, 0);
              await get().fetchEvents(start, end);
            }
          } catch (error) {
            console.warn('Failed to refresh calendar events:', error);
          }
        })(),
        (async () => {
          try {
            const updatedEvent = get().events.find((e) => e.id === id);
            if (updatedEvent) {
              const eventDate = new Date(updatedEvent.startTime);
              await dailyStore.fetchSegmentsForDate(eventDate);
            }
          } catch (error) {
            console.warn('Failed to refresh Daily Gantt after calendar update:', error);
          }
        })(),
      ]).catch(() => {
        // Background sync errors are non-critical
      });
    } catch (error: any) {
      // On error, revert optimistic update by re-fetching
      const range = get().lastFetchedRange;
      if (range) {
        get().fetchEvents(range.start, range.end);
      } else {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 2, 0);
        get().fetchEvents(start, end);
      }
      set({ error: error.message });
      throw error;
    }
  },

  deleteEvent: async (id) => {
    try {
      // Use dailyGanttStore to delete segment (unified with Daily Gantt)
      const { useDailyGanttStore } = await import('./dailyGanttStore');
      const dailyStore = useDailyGanttStore.getState();

      // Soft delete segment
      await dailyStore.deleteSegment(id);

      // Refresh events (range-aware)
      const range = get().lastFetchedRange;
      if (range) {
        await get().fetchEvents(range.start, range.end);
      } else {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 2, 0);
        await get().fetchEvents(start, end);
      }

      // Refresh Daily Gantt for the affected date
      try {
        const { useDailyGanttStore } = await import('./dailyGanttStore');
        const dailyStore = useDailyGanttStore.getState();
        const deletedEvent = get().events.find((e) => e.id === id);
        if (deletedEvent) {
          const eventDate = new Date(deletedEvent.startTime);
          await dailyStore.fetchSegmentsForDate(eventDate);
        }
      } catch (error) {
        console.warn('Failed to refresh Daily Gantt after calendar deletion:', error);
      }
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },

  connectGoogleCalendar: async () => {
    // Placeholder - will be implemented with Google Calendar OAuth
    set({ error: 'Google Calendar connection coming soon' });
  },

  syncWithGoogleCalendar: async () => {
    // Placeholder - will be implemented with Google Calendar sync
    set({ error: 'Google Calendar sync coming soon' });
  },
}));

