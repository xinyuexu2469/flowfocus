import { useState, useEffect, useRef, useCallback } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import { EventClickArg, DateSelectArg, EventContentArg, EventDropArg, EventResizeDoneArg } from "@fullcalendar/core";
import { DndContext, DragOverlay, closestCenter, useDroppable } from "@dnd-kit/core";
import { useToast } from "@/hooks/use-toast";
import { CalendarTaskListPanel } from "./CalendarTaskListPanel";
import { EventEditor } from "./EventEditor";
import { CalendarToolbar } from "./CalendarToolbar";
import { CalendarDropZone } from "./CalendarDropZone";
import { CalendarContextMenu } from "./CalendarContextMenu";
import { ResizablePanel, ResizablePanelGroup, ResizableHandle } from "@/components/ui/resizable";
import { useCalendarStore } from "@/stores/calendarStore";
import { useTaskStore } from "@/stores/taskStore";
import { TaskDialog } from "@/components/TaskDialog";
import { addHours, format } from "date-fns";
import "./calendar-styles.css";

const DEBUG_CALENDAR_LOGS = false; // Flip to true when diagnosing drag/resize

// Helper function to snap time to 15-minute increments
const snapTo15Minutes = (date: Date): Date => {
  const minutes = date.getMinutes();
  const snappedMinutes = Math.round(minutes / 15) * 15;
  const snapped = new Date(date);
  snapped.setMinutes(snappedMinutes, 0, 0);
  return snapped;
};

// Helper function to validate and clamp time within visible range
const validateAndClampTime = (
  time: Date,
  minTime: Date,
  maxTime: Date,
  otherTime: Date,
  isStart: boolean
): Date => {
  let clamped = new Date(time);
  
  // Clamp to visible time range first
  if (clamped < minTime) {
    clamped = new Date(minTime);
  } else if (clamped > maxTime) {
    clamped = new Date(maxTime);
  }
  
  // Ensure end time is not earlier than start time (with minimum 15-minute gap)
  if (isStart) {
    // If adjusting start time, ensure it's at least 15 minutes before end
    const minStart = new Date(otherTime);
    minStart.setMinutes(minStart.getMinutes() - 15);
    if (clamped >= otherTime) {
      clamped = new Date(minStart);
    }
    // Also ensure it doesn't go below the minimum start
    if (clamped < minTime) {
      clamped = new Date(minTime);
    }
  } else {
    // If adjusting end time, ensure it's at least 15 minutes after start
    const minEnd = new Date(otherTime);
    minEnd.setMinutes(minEnd.getMinutes() + 15);
    if (clamped <= otherTime) {
      clamped = new Date(minEnd);
    }
    // Also ensure it doesn't go above the maximum end
    if (clamped > maxTime) {
      clamped = new Date(maxTime);
    }
  }
  
  return clamped;
};


export function CalendarView() {
  const { events, fetchEvents, createEvent, updateEvent, deleteEvent } = useCalendarStore();
  const { tasks, fetchTasks, deleteTask } = useTaskStore();
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [currentView, setCurrentView] = useState("timeGridWeek");
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [taskPanelCollapsed, setTaskPanelCollapsed] = useState(false);
  const [activeTask, setActiveTask] = useState<any>(null);
  const [viewDateRange, setViewDateRange] = useState<{ start: Date; end: Date } | null>(null);
  const calendarRef = useRef<FullCalendar>(null);
  const { toast } = useToast();

  // Fetch events and tasks
  useEffect(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 2, 0);
    fetchEvents(start, end);
    fetchTasks();
  }, [fetchEvents, fetchTasks]);

  // Handle date select (create new event)
  const handleDateSelect = (selectInfo: DateSelectArg) => {
    const calendarApi = selectInfo.view.calendar;
    calendarApi.unselect();

    setEditingEvent({
      startTime: selectInfo.start,
      endTime: selectInfo.end,
      allDay: selectInfo.allDay,
    });
    setIsEditorOpen(true);
  };

  // Handle event click (edit existing event)
  const handleEventClick = (clickInfo: EventClickArg) => {
    const event = events.find((e) => e.id === clickInfo.event.id);
    if (event) {
      setEditingEvent({
        id: event.id,
        title: event.title,
        description: event.description,
        startTime: event.startTime,
        endTime: event.endTime,
        allDay: event.allDay,
        taskId: event.taskId,
        location: event.location,
      });
      setIsEditorOpen(true);
    }
  };

  // Handle event drop (move event - body drag)
  // This is called when the user drags the event body to move it
  const handleEventDrop = async (dropInfo: EventDropArg) => {
    if (DEBUG_CALENDAR_LOGS) {
      console.log("[Calendar] FROM MOVE - handleEventDrop called", {
        eventId: dropInfo.event.id,
        newStart: dropInfo.event.start,
        newEnd: dropInfo.event.end,
      });
    }
    
    try {
      const calendarApi = calendarRef.current?.getApi();
      if (!calendarApi) {
        dropInfo.revert();
        return;
      }

      // Get original event to calculate the delta
      const originalEvent = events.find((e) => e.id === dropInfo.event.id);
      if (!originalEvent) {
        dropInfo.revert();
        return;
      }

      const originalStart = new Date(originalEvent.startTime);
      const originalEnd = new Date(originalEvent.endTime);
      const duration = originalEnd.getTime() - originalStart.getTime();

      // Calculate new start and end times (move by the same delta)
      let newStartTime = new Date(dropInfo.event.start!);
      let newEndTime = new Date(dropInfo.event.end!);

      // Snap both to 15-minute increments
      newStartTime = snapTo15Minutes(newStartTime);
      // Calculate end based on original duration to maintain the same length
      newEndTime = new Date(newStartTime.getTime() + duration);
      newEndTime = snapTo15Minutes(newEndTime);

      // Get the view's visible time range for validation
      const view = calendarApi.view;
      const slotMinTime = view.slotMinTime || { hours: 0, minutes: 0 };
      const slotMaxTime = view.slotMaxTime || { hours: 24, minutes: 0 };
      
      const eventDate = new Date(newStartTime);
      const minTime = new Date(eventDate);
      minTime.setHours(slotMinTime.hours || 0, slotMinTime.minutes || 0, 0, 0);
      
      const maxTime = new Date(eventDate);
      if (slotMaxTime.hours === 24) {
        maxTime.setHours(23, 59, 59, 999);
      } else {
        maxTime.setHours(slotMaxTime.hours || 24, slotMaxTime.minutes || 0, 0, 0);
      }

      // Clamp to visible range
      if (newStartTime < minTime) {
        newStartTime = new Date(minTime);
        newEndTime = new Date(newStartTime.getTime() + duration);
        newEndTime = snapTo15Minutes(newEndTime);
      }
      if (newEndTime > maxTime) {
        newEndTime = new Date(maxTime);
        newStartTime = new Date(newEndTime.getTime() - duration);
        newStartTime = snapTo15Minutes(newStartTime);
        if (newStartTime < minTime) {
          newStartTime = new Date(minTime);
          newEndTime = new Date(newStartTime.getTime() + duration);
          newEndTime = snapTo15Minutes(newEndTime);
        }
      }

      // Update the event with snapped times
      await updateEvent(dropInfo.event.id, {
        startTime: newStartTime,
        endTime: newEndTime,
      });

      // Update FullCalendar's event
      dropInfo.event.setStart(newStartTime);
      dropInfo.event.setEnd(newEndTime);

      // Refresh Daily Gantt to sync (for the affected date)
      try {
        const { useDailyGanttStore } = await import("@/stores/dailyGanttStore");
        const dailyStore = useDailyGanttStore.getState();
        const dropDate = newStartTime;
        await dailyStore.fetchSegmentsForDate(dropDate);
        
        // Also refresh original date if it changed
        const originalDateKey = format(originalStart, 'yyyy-MM-dd');
        const newDateKey = format(newStartTime, 'yyyy-MM-dd');
        if (originalDateKey !== newDateKey) {
          await dailyStore.fetchSegmentsForDate(originalStart);
        }
      } catch (error) {
        console.warn('Failed to refresh Daily Gantt after event drop:', error);
      }

      // Refresh taskStore to update box membership based on Work Time Blocks
      try {
        const { useTaskStore } = await import("@/stores/taskStore");
        await useTaskStore.getState().refreshSegments();
      } catch (error) {
        console.warn('Failed to refresh task store after event drop:', error);
      }

      toast({
        title: "Event moved",
        description: `Moved to ${format(newStartTime, "h:mm a")} - ${format(newEndTime, "h:mm a")}`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error moving event",
        description: error.message,
      });
      dropInfo.revert();
    }
  };

  // Handle event resize with 15-minute snapping and validation
  // Supports resizing from both top (start) and bottom (end) edges
  const handleEventResize = async (resizeInfo: EventResizeDoneArg) => {
    try {
      const calendarApi = calendarRef.current?.getApi();
      if (!calendarApi) {
        resizeInfo.revert();
        return;
      }

      // Get the view's visible time range
      const view = calendarApi.view;
      const slotMinTime = view.slotMinTime || { hours: 0, minutes: 0 };
      const slotMaxTime = view.slotMaxTime || { hours: 24, minutes: 0 };
      
      // Create min and max time boundaries for the current day
      const eventDate = new Date(resizeInfo.event.start!);
      const minTime = new Date(eventDate);
      minTime.setHours(slotMinTime.hours || 0, slotMinTime.minutes || 0, 0, 0);
      
      const maxTime = new Date(eventDate);
      if (slotMaxTime.hours === 24) {
        maxTime.setHours(23, 59, 59, 999);
      } else {
        maxTime.setHours(slotMaxTime.hours || 24, slotMaxTime.minutes || 0, 0, 0);
      }

      // Get original event to determine if start or end changed
      const originalEvent = events.find((e) => e.id === resizeInfo.event.id);
      if (!originalEvent) {
        resizeInfo.revert();
        return;
      }

      let newStartTime = new Date(resizeInfo.event.start!);
      let newEndTime = new Date(resizeInfo.event.end!);
      const originalStart = new Date(originalEvent.startTime);
      const originalEnd = new Date(originalEvent.endTime);
      const originalDuration = originalEnd.getTime() - originalStart.getTime();

      // Determine which edge was resized
      // FullCalendar's resize event is triggered when resizing from either edge
      // We detect by comparing which time changed more significantly
      const startDelta = Math.abs(newStartTime.getTime() - originalStart.getTime());
      const endDelta = Math.abs(newEndTime.getTime() - originalEnd.getTime());
      
      // More reliable detection: if start changed and end didn't (or changed very little), it's top edge
      // If end changed and start didn't (or changed very little), it's bottom edge
      // Threshold: if one changed by more than 5 minutes and the other by less than 1 minute, it's clear
      const startChangedSignificantly = startDelta > 5 * 60 * 1000; // More than 5 minutes
      const endChangedSignificantly = endDelta > 5 * 60 * 1000; // More than 5 minutes
      const startChangedMinimally = startDelta < 1 * 60 * 1000; // Less than 1 minute
      const endChangedMinimally = endDelta < 1 * 60 * 1000; // Less than 1 minute
      
      // Determine resize direction
      let isTopEdgeResize = false;
      let isBottomEdgeResize = false;
      
      if (startChangedSignificantly && endChangedMinimally) {
        // Start changed a lot, end barely changed - definitely top edge resize
        isTopEdgeResize = true;
        if (DEBUG_CALENDAR_LOGS) {
          console.log("[Calendar] FROM START - Top edge resize detected", {
            eventId: resizeInfo.event.id,
            startDelta: startDelta / 60000 + " min",
            endDelta: endDelta / 60000 + " min",
          });
        }
      } else if (endChangedSignificantly && startChangedMinimally) {
        // End changed a lot, start barely changed - definitely bottom edge resize
        isBottomEdgeResize = true;
        if (DEBUG_CALENDAR_LOGS) {
          console.log("[Calendar] FROM END - Bottom edge resize detected", {
            eventId: resizeInfo.event.id,
            startDelta: startDelta / 60000 + " min",
            endDelta: endDelta / 60000 + " min",
          });
        }
      } else if (startDelta > endDelta * 2) {
        // Start changed more than twice as much as end - likely top edge
        isTopEdgeResize = true;
        if (DEBUG_CALENDAR_LOGS) {
          console.log("[Calendar] FROM START - Top edge resize (relative)", {
            eventId: resizeInfo.event.id,
            startDelta: startDelta / 60000 + " min",
            endDelta: endDelta / 60000 + " min",
          });
        }
      } else if (endDelta > startDelta * 2) {
        // End changed more than twice as much as start - likely bottom edge
        isBottomEdgeResize = true;
        if (DEBUG_CALENDAR_LOGS) {
          console.log("[Calendar] FROM END - Bottom edge resize (relative)", {
            eventId: resizeInfo.event.id,
            startDelta: startDelta / 60000 + " min",
            endDelta: endDelta / 60000 + " min",
          });
        }
      } else {
        // Ambiguous - use relative comparison with higher threshold
        if (startDelta > endDelta * 1.5 && startDelta > 2 * 60 * 1000) {
          isTopEdgeResize = true;
          if (DEBUG_CALENDAR_LOGS) {
            console.log("[Calendar] FROM START - Top edge resize (ambiguous case)", {
              eventId: resizeInfo.event.id,
              startDelta: startDelta / 60000 + " min",
              endDelta: endDelta / 60000 + " min",
            });
          }
        } else if (endDelta > startDelta * 1.5 && endDelta > 2 * 60 * 1000) {
          isBottomEdgeResize = true;
          if (DEBUG_CALENDAR_LOGS) {
            console.log("[Calendar] FROM END - Bottom edge resize (ambiguous case)", {
              eventId: resizeInfo.event.id,
              startDelta: startDelta / 60000 + " min",
              endDelta: endDelta / 60000 + " min",
            });
          }
        } else {
          if (DEBUG_CALENDAR_LOGS) {
            console.warn("[Calendar] Resize direction ambiguous, defaulting to bottom edge", {
              eventId: resizeInfo.event.id,
              startDelta: startDelta / 60000 + " min",
              endDelta: endDelta / 60000 + " min",
            });
          }
        }
      }
      
      // Snap both times to 15-minute increments first
      newStartTime = snapTo15Minutes(newStartTime);
      newEndTime = snapTo15Minutes(newEndTime);

      // Apply resize logic based on which edge was dragged
      if (isTopEdgeResize) {
        // TOP EDGE RESIZE: Only change start time, keep end time fixed
        newStartTime = validateAndClampTime(newStartTime, minTime, maxTime, originalEnd, true);
        newEndTime = new Date(originalEnd); // Keep original end time
        // Re-snap after validation
        newStartTime = snapTo15Minutes(newStartTime);
      } else if (isBottomEdgeResize) {
        // BOTTOM EDGE RESIZE: Only change end time, keep start time fixed
        newEndTime = validateAndClampTime(newEndTime, minTime, maxTime, originalStart, false);
        newStartTime = new Date(originalStart); // Keep original start time
        // Re-snap after validation
        newEndTime = snapTo15Minutes(newEndTime);
      } else {
        // Ambiguous case - both changed similarly (shouldn't happen in resize, but handle gracefully)
        // Assume it's a bottom edge resize if end changed, otherwise top edge
        if (endDelta > startDelta) {
          newEndTime = validateAndClampTime(newEndTime, minTime, maxTime, originalStart, false);
          newStartTime = new Date(originalStart);
          newEndTime = snapTo15Minutes(newEndTime);
        } else {
          newStartTime = validateAndClampTime(newStartTime, minTime, maxTime, originalEnd, true);
          newEndTime = new Date(originalEnd);
          newStartTime = snapTo15Minutes(newStartTime);
        }
      }

      // Final validation: ensure end time is after start time (minimum 15 minutes)
      if (newEndTime <= newStartTime) {
        // If end is not after start, enforce minimum 15-minute duration
        if (isTopEdgeResize) {
          // If start was resized from top, adjust end to be 15 minutes after start
          newEndTime = new Date(newStartTime);
          newEndTime.setMinutes(newEndTime.getMinutes() + 15);
          newEndTime = snapTo15Minutes(newEndTime);
        } else {
          // If end was resized from bottom, adjust start to be 15 minutes before end
          newStartTime = new Date(newEndTime);
          newStartTime.setMinutes(newStartTime.getMinutes() - 15);
          newStartTime = snapTo15Minutes(newStartTime);
        }
      }

      // Final clamp to visible range
      if (newStartTime < minTime) {
        newStartTime = new Date(minTime);
        // Ensure end is still valid
        if (newEndTime <= newStartTime) {
          newEndTime = new Date(newStartTime);
          newEndTime.setMinutes(newEndTime.getMinutes() + 15);
          newEndTime = snapTo15Minutes(newEndTime);
        }
      }
      if (newStartTime > maxTime) {
        newStartTime = new Date(maxTime);
        newEndTime = new Date(newStartTime);
        newEndTime.setMinutes(newEndTime.getMinutes() + 15);
        newEndTime = snapTo15Minutes(newEndTime);
      }
      if (newEndTime < minTime) {
        newEndTime = new Date(minTime);
        newStartTime = new Date(newEndTime);
        newStartTime.setMinutes(newStartTime.getMinutes() - 15);
        newStartTime = snapTo15Minutes(newStartTime);
      }
      if (newEndTime > maxTime) {
        newEndTime = new Date(maxTime);
        // Ensure start is still valid
        if (newStartTime >= newEndTime) {
          newStartTime = new Date(newEndTime);
          newStartTime.setMinutes(newStartTime.getMinutes() - 15);
          newStartTime = snapTo15Minutes(newStartTime);
        }
      }

      // Update the event with snapped and validated times
      await updateEvent(resizeInfo.event.id, {
        startTime: newStartTime,
        endTime: newEndTime,
      });

      // Update FullCalendar's event to reflect the snapped times
      resizeInfo.event.setStart(newStartTime);
      resizeInfo.event.setEnd(newEndTime);

      // Refresh Daily Gantt to sync (for the affected date)
      try {
        const { useDailyGanttStore } = await import("@/stores/dailyGanttStore");
        const dailyStore = useDailyGanttStore.getState();
        const resizeDate = newStartTime;
        await dailyStore.fetchSegmentsForDate(resizeDate);
      } catch (error) {
        console.warn('Failed to refresh Daily Gantt after event resize:', error);
      }

      // Refresh taskStore to update box membership based on Work Time Blocks
      try {
        const { useTaskStore } = await import("@/stores/taskStore");
        await useTaskStore.getState().refreshSegments();
      } catch (error) {
        console.warn('Failed to refresh task store after event resize:', error);
      }

      toast({
        title: "Event resized",
        description: `Updated to ${format(newStartTime, "h:mm a")} - ${format(newEndTime, "h:mm a")}`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error resizing event",
        description: error.message,
      });
      resizeInfo.revert();
    }
  };

  // DISABLED: Sidebar drag-to-calendar feature to prevent page freeze
  const ENABLE_SIDEBAR_DRAG_CREATE = false;

  // Track drag position for external drag
  const [dragPosition, setDragPosition] = useState<{ date: Date; allDay: boolean } | null>(null);

  // DISABLED: Handle drag and drop from task list
  const handleDragStart = (event: any) => {
    if (!ENABLE_SIDEBAR_DRAG_CREATE) return;
    if (event.active.data.current?.type === "task") {
      setActiveTask(event.active.data.current.task);
    }
  };

  const handleDragMove = (event: any) => {
    if (!ENABLE_SIDEBAR_DRAG_CREATE) return;
    // FullCalendar will handle the drop position via its drop event
    // We just track that we're dragging
  };

  const handleDragEnd = async (event: any) => {
    if (!ENABLE_SIDEBAR_DRAG_CREATE) {
      setActiveTask(null);
      setDragPosition(null);
      return;
    }
    
    const { active, over } = event;

    // Only handle if dropped on calendar drop zone
    if (over && over.id === "calendar-drop-zone") {
      const task = active.data.current?.task;
      
      if (!task) {
        setActiveTask(null);
        setDragPosition(null);
        return;
      }

      // Note: FullCalendar's drop event will handle the actual drop position
      // This is just a fallback - the real drop is handled by handleExternalDrop
      // We'll let FullCalendar handle it via its drop event
      setActiveTask(null);
      setDragPosition(null);
      return;
    }

    // If not dropped on calendar, just clean up
    setActiveTask(null);
    setDragPosition(null);
  };

  // DISABLED: Handle FullCalendar's external drop event (when dragging from task list)
  const handleExternalDrop = async (dropInfo: any) => {
    if (!ENABLE_SIDEBAR_DRAG_CREATE) {
      return; // Do nothing if feature is disabled
    }
    if (DEBUG_CALENDAR_LOGS) {
      console.log('FullCalendar drop event:', dropInfo);
    }
    
    // Try to get task from activeTask first, then from dropInfo
    let task = activeTask;
    
    if (!task && dropInfo.draggedEl) {
      // Try to get task ID from data attribute
      const taskId = dropInfo.draggedEl.getAttribute('data-task-id');
      if (DEBUG_CALENDAR_LOGS) {
        console.log('Task ID from data attribute:', taskId);
      }
      if (taskId) {
        task = tasks.find((t) => t.id === taskId);
      }
    }
    
    // Also try to get from dnd-kit active data
    if (!task && dropInfo.draggedEl) {
      // Check if it's a dnd-kit draggable
      const dndKitId = dropInfo.draggedEl.getAttribute('data-rbd-draggable-id') || 
                       dropInfo.draggedEl.id;
      if (dndKitId && dndKitId.startsWith('task-')) {
        const taskId = dndKitId.replace('task-', '');
        task = tasks.find((t) => t.id === taskId);
      }
    }
    
    if (task) {
      const dropDate = dropInfo.date;
      const allDay = dropInfo.allDay || false;
      
      try {
        // Default duration: 1 hour (fixed)
        const defaultDuration = 1; // 1 hour
        await createEvent({
          title: task.title,
          description: task.description || undefined,
          startTime: dropDate,
          endTime: addHours(dropDate, defaultDuration),
          allDay,
          taskId: task.id,
          source: "app",
        });

        toast({
          title: "Task scheduled",
          description: `"${task.title}" has been added to your calendar.`,
        });
        
        // Refresh events
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 2, 0);
        await fetchEvents(start, end);
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "Error",
          description: error.message,
        });
      }
      
      setActiveTask(null);
      setDragPosition(null);
    } else {
      console.warn('No task found for drop:', dropInfo);
    }
  };

  const handleEventSave = async (data: any) => {
    try {
      if (editingEvent?.id) {
        await updateEvent(editingEvent.id, data);
      } else {
        await createEvent({
          ...data,
          source: "app",
        });
      }

      // Refresh events
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 2, 0);
      await fetchEvents(start, end);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    }
  };

  const handleEventDelete = async () => {
    if (editingEvent?.id) {
      try {
        // If this calendar item is linked to a task, delete the task so all tabs stay consistent.
        // Otherwise (custom event / unlinked), delete only the time segment.
        if (editingEvent.taskId) {
          await deleteTask(editingEvent.taskId);
        } else {
          await deleteEvent(editingEvent.id);
        }
        toast({
          title: "Event deleted",
          description: "The event has been removed.",
        });
        setIsEditorOpen(false);
        setEditingEvent(null);
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "Error",
          description: error.message,
        });
      }
    }
  };

  const handleViewChange = (view: string) => {
    setCurrentView(view);
    const calendarApi = calendarRef.current?.getApi();
    if (calendarApi) {
      calendarApi.changeView(view);
      // Update date range after view change
      const viewInfo = calendarApi.view;
      if (viewInfo) {
        setViewDateRange({
          start: viewInfo.activeStart,
          end: viewInfo.activeEnd,
        });
      }
    }
  };

  // Handle dates change (when navigating or view changes)
  const handleDatesSet = (dateInfo: any) => {
    setViewDateRange({
      start: dateInfo.start,
      end: dateInfo.end,
    });
  };

  const handleToday = useCallback(() => {
    const calendarApi = calendarRef.current?.getApi();
    if (calendarApi) {
      calendarApi.today();
      setCurrentDate(new Date());
    }
  }, []);

  const handlePrev = useCallback(() => {
    const calendarApi = calendarRef.current?.getApi();
    if (calendarApi) {
      calendarApi.prev();
      setCurrentDate(new Date(calendarApi.getDate()));
    }
  }, []);

  const handleNext = useCallback(() => {
    const calendarApi = calendarRef.current?.getApi();
    if (calendarApi) {
      calendarApi.next();
      setCurrentDate(new Date(calendarApi.getDate()));
    }
  }, []);

  // Handle date picker selection - navigate to selected date
  const handleDatePickerSelect = useCallback((date: Date) => {
    const calendarApi = calendarRef.current?.getApi();
    if (calendarApi) {
      calendarApi.gotoDate(date);
      setCurrentDate(date);
    }
  }, []);

  // Convert events to FullCalendar format
  const calendarEvents = events.map((event) => {
    const task = tasks.find((t) => t.id === event.taskId);
    // 使用设计系统颜色，不透明版本（降低亮度，增加饱和度）
    const priorityColors: { [key: string]: string } = {
      urgent: "hsl(0, 55%, 70%)",      // 基于destructive (0, 72%, 60%)，更不透明
      high: "hsl(25, 65%, 70%)",       // 基于accent (25, 85%, 65%)，更不透明
      medium: "hsl(185, 55%, 65%)",    // 基于primary (185, 80%, 48%)，更不透明
      low: "hsl(210, 20%, 75%)",       // 基于muted (210, 20%, 95%)，更不透明
    };

    return {
      id: event.id,
      title: event.title,
      start: event.startTime.toISOString(),
      end: event.endTime.toISOString(),
      allDay: event.allDay,
      backgroundColor: task
        ? priorityColors[task.priority]
        : "#3b82f6",
      borderColor: task
        ? priorityColors[task.priority]
        : "#3b82f6",
      extendedProps: {
        taskId: event.taskId,
        priority: task?.priority,
        tags: task?.tags,
      },
    };
  });

  const renderEventContent = (eventInfo: EventContentArg) => {
    const { priority } = eventInfo.event.extendedProps;
    const event = events.find((e) => e.id === eventInfo.event.id);

    return (
      <CalendarContextMenu
        event={{
          id: eventInfo.event.id,
          title: eventInfo.event.title,
          startTime: new Date(eventInfo.event.start!),
          endTime: new Date(eventInfo.event.end!),
          description: event?.description,
          taskId: event?.taskId,
          location: event?.location,
        }}
        onEdit={() => {
          if (event) {
            setEditingEvent({
              id: event.id,
              title: event.title,
              description: event.description,
              startTime: event.startTime,
              endTime: event.endTime,
              allDay: event.allDay,
              taskId: event.taskId,
              location: event.location,
            });
            setIsEditorOpen(true);
          }
        }}
      >
        {/* Event body - only show title, truncate with ellipsis if too long */}
        {/* Top and bottom edges are reserved for FullCalendar's native resize handles */}
        <div 
          className="px-2 py-1 overflow-hidden w-full h-full calendar-event-body"
          style={{ 
            pointerEvents: 'auto',
            // Reserve top and bottom space for resize handles (8px each)
            paddingTop: '8px',
            paddingBottom: '8px',
            // Lower z-index so resize handles are on top
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            alignItems: 'flex-start',
          }}
        >
          {/* Only show title - use ellipsis for overflow */}
          <div 
            className="text-xs font-medium leading-tight"
            style={{
              width: '100%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              wordBreak: 'break-word',
            }}
          >
            {eventInfo.event.title}
          </div>
        </div>
      </CalendarContextMenu>
    );
  };

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
    >
      <div className="calendar-page h-full flex flex-col bg-background">
        {/* Main content */}
        <div className="flex-1 flex overflow-hidden">
          <ResizablePanelGroup direction="horizontal" className="h-full">
            {/* Left: Task List Panel */}
            {!taskPanelCollapsed && (
              <>
                <ResizablePanel defaultSize={25} minSize={20} maxSize={40}>
                  <CalendarTaskListPanel
                    onCollapse={() => setTaskPanelCollapsed(true)}
                    currentView={currentView}
                    dateRange={viewDateRange}
                    onTaskDoubleClick={(task) => {
                      // Get fresh task from global store to ensure we have latest data
                      const freshTask = tasks.find(t => t.id === task.id);
                      if (freshTask) {
                        setEditingTask(freshTask);
                      } else {
                        setEditingTask(task); // Fallback to passed task if not found in store
                      }
                      setTaskDialogOpen(true);
                    }}
                  />
                </ResizablePanel>
                <ResizableHandle className="w-1 bg-border hover:bg-primary/20 transition-colors" />
              </>
            )}

            {/* Right: Calendar Area */}
            <ResizablePanel>
              <div className="h-full flex flex-col">
                <CalendarToolbar
                  currentView={currentView}
                  onViewChange={handleViewChange}
                  onToday={handleToday}
                  onPrev={handlePrev}
                  onNext={handleNext}
                  currentDate={currentDate}
                  onDateSelect={handleDatePickerSelect}
                />

                {/* Calendar container - CRITICAL FIX */}
                <CalendarDropZone>
                  <div className="flex-1 overflow-auto calendar-wrapper h-full">
                    <FullCalendar
                    ref={calendarRef}
                    plugins={[
                      dayGridPlugin,
                      timeGridPlugin,
                      listPlugin,
                      interactionPlugin,
                    ]}
                    initialView="timeGridWeek"
                    headerToolbar={false}
                    height="100%"
                    events={calendarEvents}
                    editable={true}
                    selectable={true}
                    selectMirror={true}
                    selectOverlap={true}
                    eventOverlap={true}
                    dayMaxEvents={true}
                    weekends={true}
                    droppable={false}
                    select={handleDateSelect}
                    drop={ENABLE_SIDEBAR_DRAG_CREATE ? handleExternalDrop : undefined}
                    eventClick={handleEventClick}
                    eventDrop={handleEventDrop}
                    eventResize={handleEventResize}
                    datesSet={handleDatesSet}
                    eventStartEditable={true}
                    eventDurationEditable={true}
                    eventResizableFromStart={true}
                    eventContent={renderEventContent}
                    eventDragStart={(info) => {
                      // Show preview during drag
                      info.el.style.opacity = '0.5';
                    }}
                    eventDragStop={(info) => {
                      // Restore opacity
                      info.el.style.opacity = '1';
                    }}
                    eventResizeStart={(info) => {
                      // Show preview during resize
                      info.el.style.opacity = '0.5';
                    }}
                    eventResizeStop={(info) => {
                      // Restore opacity
                      info.el.style.opacity = '1';
                    }}
                    slotMinTime="00:00:00"
                    slotMaxTime="24:00:00"
                    slotDuration="00:15:00"
                    snapDuration="00:15:00"
                    allDaySlot={true}
                    nowIndicator={true}
                    scrollTime="07:00:00"
                    expandRows={true}
                    eventTimeFormat={{
                      hour: "numeric",
                      minute: "2-digit",
                      meridiem: "short",
                    }}
                    slotLabelFormat={{
                      hour: "numeric",
                      minute: "2-digit",
                      meridiem: "short",
                    }}
                    dayHeaderFormat={{
                      weekday: "short",
                      day: "numeric",
                      omitCommas: true,
                    }}
                  />
                  </div>
                </CalendarDropZone>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>

        {/* Event editor */}
        <EventEditor
          open={isEditorOpen}
          onOpenChange={setIsEditorOpen}
          event={editingEvent}
          onSave={handleEventSave}
          onDelete={handleEventDelete}
        />

        {/* Task Dialog - unified task editing */}
        <TaskDialog
          open={taskDialogOpen}
          onOpenChange={(open) => {
            setTaskDialogOpen(open);
            if (!open) setEditingTask(null);
          }}
          onSuccess={async () => {
            // TaskDialog already refreshes taskStore internally
            // Refresh calendar events to show updated schedule
            await fetchEvents(
              new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1),
              new Date(new Date().getFullYear(), new Date().getMonth() + 2, 0)
            );
          }}
          editTask={editingTask}
        />

        {/* DISABLED: Drag overlay for sidebar drag-to-calendar feature */}
        {ENABLE_SIDEBAR_DRAG_CREATE && (
          <DragOverlay>
            {activeTask && (
              <div className="task-card-preview border rounded-lg p-3 bg-card shadow-lg">
                <div className="font-medium">{activeTask.title}</div>
                <div className="text-sm text-muted-foreground">
                  Drop on calendar to schedule
                </div>
              </div>
            )}
          </DragOverlay>
        )}
      </div>
    </DndContext>
  );
}
