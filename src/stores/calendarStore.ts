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
  googleCalendarConnected: boolean;
  visibleCalendars: string[];
  loading: boolean;
  error: string | null;

  // Actions
  fetchEvents: (start: Date, end: Date) => Promise<void>;
  createEvent: (event: Omit<CalendarEvent, 'id'>) => Promise<void>;
  updateEvent: (id: string, updates: Partial<CalendarEvent>) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  connectGoogleCalendar: () => Promise<void>;
  syncWithGoogleCalendar: () => Promise<void>;
}

export const useCalendarStore = create<CalendarStore>((set, get) => ({
  events: [],
  googleCalendarConnected: false,
  visibleCalendars: ['primary'],
  loading: false,
  error: null,

  fetchEvents: async (start, end) => {
    set({ loading: true, error: null });
    try {
      const api = getApiClient();

      // Fetch time segments (unified with Daily Gantt)
      // Get all segments in the date range
      const startStr = format(start, 'yyyy-MM-dd');
      const endStr = format(end, 'yyyy-MM-dd');
      
      // Fetch segments for each day in range (simplified - could be optimized)
      const allSegments: any[] = [];
      const currentDate = new Date(start);
      while (currentDate <= end) {
        try {
          const dateStr = format(currentDate, 'yyyy-MM-dd');
          const segments = await api.timeSegments.getByDate(dateStr) as any[];
          allSegments.push(...segments.filter(s => !s.deleted_at));
          currentDate.setDate(currentDate.getDate() + 1);
        } catch (error) {
          // Skip days with errors
          currentDate.setDate(currentDate.getDate() + 1);
        }
      }

      // Filter by time range and fetch task data
      const events: CalendarEvent[] = [];
      for (const segment of allSegments) {
        const segmentStart = new Date(segment.start_time);
        if (segmentStart >= start && segmentStart <= end) {
          // Fetch task if task_id exists
          let task = null;
          if (segment.task_id) {
            try {
              task = await api.tasks.getById(segment.task_id);
            } catch (error) {
              // Task not found, continue without task data
            }
          }

          events.push({
            id: segment.id,
            taskId: segment.task_id || undefined,
            googleEventId: segment.google_calendar_event_id || undefined,
            title: segment.title || task?.title || 'Untitled',
            description: segment.description || segment.notes || task?.description || undefined,
            startTime: new Date(segment.start_time),
            endTime: new Date(segment.end_time),
            allDay: false,
            location: undefined, // time_segments doesn't have location field
            source: segment.source || 'app',
          });
        }
      }

      // Sort by start time
      events.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

      set({ events, loading: false });
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

      // Refresh events
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 2, 0);
      await get().fetchEvents(start, end);

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
            const now = new Date();
            const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const end = new Date(now.getFullYear(), now.getMonth() + 2, 0);
            await get().fetchEvents(start, end);
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
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 2, 0);
      get().fetchEvents(start, end);
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

      // Refresh events
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 2, 0);
      await get().fetchEvents(start, end);

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

