import React, { useMemo } from "react";
import { useTaskStore } from "@/stores/taskStore";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { startOfDay, addDays } from "date-fns";
import { normalizeToDate } from "@/utils/taskBoxUtils";
import { DraggableTaskCard } from "./DraggableTaskCard";
import { Task } from "@/stores/taskStore";
import { getTaskBoxDates } from "@/utils/taskBoxUtils";
import { SidebarTaskList } from "@/components/shared/SidebarTaskList";

interface CalendarTaskListPanelProps {
  onCollapse?: () => void;
  currentView: string;
  dateRange: { start: Date; end: Date } | null;
  onTaskDoubleClick?: (task: Task) => void;
}


export const CalendarTaskListPanel: React.FC<CalendarTaskListPanelProps> = ({
  onCollapse,
  currentView,
  dateRange,
  onTaskDoubleClick,
}) => {
  const { 
    tasks, 
    segmentsByTask
  } = useTaskStore();

  // Filter tasks based on current view and date range using box dates
  const filteredTasksWithBoxKey = useMemo(() => {
    if (!dateRange) {
      return [];
    }

    const { start, end } = dateRange;
    const filtered: Task[] = [];
    const seenTaskIds = new Set<string>();

    // Determine the date range to filter by based on view
    // FullCalendar's datesSet callback provides the visible range in dateInfo.start and dateInfo.end
    // We normalize these to ensure consistent comparison with box dates
    let filterStart: Date;
    let filterEnd: Date;

    if (currentView === "timeGridDay") {
      // Day view: start = that day at 00:00, end = next day at 00:00 (exclusive)
      filterStart = startOfDay(start);
      filterEnd = startOfDay(addDays(start, 1)); // Exclusive: next day at 00:00
    } else if (currentView === "timeGridWeek" || currentView === "listWeek") {
      // Week view: start = first day of week at 00:00, end = start + 7 days (exclusive)
      // FullCalendar's dateRange.start is already the first day of the week
      filterStart = startOfDay(start);
      filterEnd = startOfDay(addDays(start, 7)); // Exclusive: 7 days after start at 00:00
    } else if (currentView === "dayGridMonth") {
      // Month view: start = first day shown in grid at 00:00, end = day after last day (exclusive)
      // FullCalendar provides the actual visible range including padding days
      filterStart = startOfDay(start);
      filterEnd = startOfDay(end); // end is already exclusive from FullCalendar
    } else {
      // Agenda/listWeek and other views: use the provided date range
      // FullCalendar's dateInfo.end is already exclusive
      filterStart = startOfDay(start);
      filterEnd = startOfDay(end);
    }

    // Filter tasks using box dates
    for (const task of tasks) {
      // Skip completed tasks and subtasks
      if (task.status === "completed" || task.parent_task_id) {
        continue;
      }

      // Get box dates for this task
      const boxDates = getTaskBoxDates(task, segmentsByTask);
      
      // If task has no box dates, skip it
      if (boxDates.length === 0) {
        continue;
      }

      // Check if any box date falls within the filter range
      let isInRange = false;

      // Normalize all box dates for consistent comparison
      const normalizedBoxDates = boxDates.map(d => normalizeToDate(d));
      
      // Check if any normalized box date falls within the filter range
      // Use >= for start (inclusive) and < for end (exclusive)
      isInRange = normalizedBoxDates.some(boxDate => {
        return boxDate >= filterStart && boxDate < filterEnd;
      });

      // For week views (timeGridWeek and listWeek), deduplicate tasks
      if ((currentView === "timeGridWeek" || currentView === "listWeek") && isInRange) {
        if (!seenTaskIds.has(task.id)) {
          seenTaskIds.add(task.id);
          filtered.push(task);
        }
        continue; // Skip to next task for week views to handle deduplication
      }

      // For non-week views, add task if in range
      if (isInRange && currentView !== "timeGridWeek" && currentView !== "listWeek") {
        filtered.push(task);
      }
    }

    // Sort by global order field (primary), then by createdAt as fallback
    // This ensures consistent ordering across all views (Calendar, Daily Gantt, Monthly Gantt)
    const orderedTasks = filtered.sort((a, b) => {
      // Primary: order field (user-defined manual ordering from drag & drop)
      if (a.order !== b.order) {
        return a.order - b.order;
      }
      // Fallback: createdAt for stable ordering among tasks with same order
      const createdAtA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const createdAtB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return createdAtA - createdAtB;
    });

    return orderedTasks;
  }, [tasks, segmentsByTask, currentView, dateRange]);

  const filteredTasks = filteredTasksWithBoxKey || [];

  const handleReorder = async (taskIds: string[]) => {
    // Update global task order and persist to backend
    // This ensures the order is consistent across all views (Calendar, Daily Gantt, Monthly Gantt)
    // Uses optimistic updates for smooth UX
    const taskStore = useTaskStore.getState();
    try {
      await taskStore.reorderTasks(taskIds);
    } catch (error) {
      console.error('Failed to update task order:', error);
      // Error handling is done in reorderTasks (refetch on failure)
    }
  };

  return (
    <div className="task-list-panel h-full bg-card border-r flex flex-col">
      {/* Header */}
      <div className="border-b px-4 py-3 flex items-center justify-between flex-shrink-0">
        <h2 className="font-semibold">Tasks</h2>
        {onCollapse && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onCollapse}
            className="h-8 w-8"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* View info */}
      <div className="border-b px-4 py-2 flex-shrink-0">
        <div className="text-xs text-muted-foreground">
          {currentView === "timeGridDay" && "Today's Tasks"}
          {currentView === "timeGridWeek" && "This Week's Tasks"}
          {currentView === "dayGridMonth" && "This Month's Tasks"}
          {currentView === "listWeek" && "This Week's Tasks"}
        </div>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        <SidebarTaskList
          tasks={filteredTasks}
          onReorder={handleReorder}
          renderTask={(task) => (
            <DraggableTaskCard 
              task={task} 
              onDoubleClick={onTaskDoubleClick}
            />
          )}
          emptyMessage="No tasks to display"
        />
      </div>
    </div>
  );
};

