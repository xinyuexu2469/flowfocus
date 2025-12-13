import { useState, useEffect, useMemo } from "react";
import { useTaskStore } from "@/stores/taskStore";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { format, startOfWeek, endOfWeek, addWeeks, isSameDay } from "date-fns";
import { Calendar, Clock, Tag, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import { Task } from "@/stores/taskStore";
import { TaskDialog } from "./TaskDialog";
import { getTaskBoxDates } from "@/utils/taskBoxUtils";

interface KanbanColumn {
  id: string;
  title: string;
  tasks: Task[];
}

// Time range types
type TimeRangeType = "day" | "week";

interface DateRange {
  start: Date;
  end: Date;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// Draggable Task Card Component
interface KanbanTaskCardProps {
  task: Task;
  onDoubleClick: () => void;
}

const KanbanTaskCard = ({ task, onDoubleClick }: KanbanTaskCardProps) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "🔴";
      case "high":
        return "🟡";
      case "medium":
        return "🔵";
      case "low":
        return "⚪";
      default:
        return "⚪";
    }
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`p-4 cursor-move hover:shadow-md transition-shadow ${
        isDragging ? "opacity-50" : ""
      }`}
      onDoubleClick={onDoubleClick}
      title="Double-click to edit"
      {...listeners}
      {...attributes}
    >
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h5 className="font-medium text-sm flex-1">{task.title}</h5>
          <span className="text-xs">{getPriorityIcon(task.priority || "low")}</span>
        </div>

        {task.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>
        )}

        <div className="flex flex-wrap gap-1">
          {task.deadline && task.planned_date && task.deadline !== task.planned_date && (
            <Badge variant="outline" className="text-xs gap-1">
              <Calendar className="w-3 h-3" />
              Due: {format(new Date(task.deadline), "MMM d")}
            </Badge>
          )}
          {task.estimated_minutes && (
            <Badge variant="outline" className="text-xs gap-1">
              <Clock className="w-3 h-3" />
              {task.estimated_minutes}m
            </Badge>
          )}
          {task.tags.slice(0, 2).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs gap-1">
              <Tag className="w-3 h-3" />
              {tag}
            </Badge>
          ))}
          {task.tags.length > 2 && (
            <Badge variant="secondary" className="text-xs">
              +{task.tags.length - 2}
            </Badge>
          )}
        </div>

        {task.planned_date && (
          <div className="text-xs text-muted-foreground">
            Planned: {format(new Date(task.planned_date), "MMM d")}
          </div>
        )}
      </div>
    </Card>
  );
};

// Droppable Column Component
interface KanbanColumnDropZoneProps {
  columnId: string;
  children: React.ReactNode;
}

const KanbanColumnDropZone = ({ columnId, children }: KanbanColumnDropZoneProps) => {
  const { setNodeRef, isOver } = useDroppable({
    id: columnId,
  });

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[400px] space-y-3 p-3 bg-muted/30 rounded-lg ${
        isOver ? "bg-primary/10 border-2 border-primary" : ""
      }`}
    >
      {children}
    </div>
  );
};

export const KanbanView = () => {
  const { tasks, fetchTasks, updateTask, segmentsByTask, refreshSegments } = useTaskStore();
  const { toast } = useToast();
  const [timeRange, setTimeRange] = useState<TimeRangeType>("week"); // "day" or "week"
  const [currentDate, setCurrentDate] = useState<Date>(new Date()); // Current selected date/week anchor
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3,
      },
    })
  );

  useEffect(() => {
    const loadData = async () => {
      await fetchTasks();
      await refreshSegments();
    };
    loadData();
  }, [fetchTasks, refreshSegments]);

  // PRD: Calculate date range based on selected time range type and current date
  const dateRange = useMemo((): DateRange => {
    if (timeRange === "day") {
      return { start: currentDate, end: currentDate };
    } else {
      // week
      return { start: startOfWeek(currentDate), end: endOfWeek(currentDate) };
    }
  }, [timeRange, currentDate]);

  // PRD: Filter tasks by "The Box" logic - tasks appear in all days where they have segments
  const filteredTasks = useMemo(() => {
    console.log("[KANBAN] Filtering tasks with date range:", {
      start: format(dateRange.start, "yyyy-MM-dd"),
      end: format(dateRange.end, "yyyy-MM-dd"),
      totalTasks: tasks.length,
      segmentsMapSize: segmentsByTask.size,
    });

    const startDate = format(dateRange.start, "yyyy-MM-dd");
    const endDate = format(dateRange.end, "yyyy-MM-dd");

    // Filter out subtasks - they should not appear in Kanban view
    const mainTasks = tasks.filter((task) => !task.parent_task_id);
    
    return mainTasks.filter((task) => {
      // Get segments for this task (only non-deleted, source='task' or 'app')
      const taskSegments = (segmentsByTask.get(task.id) || []).filter(
        (seg) => !seg.deleted_at && (seg.source === 'task' || seg.source === 'app')
      );

      console.log(`[KANBAN] Task "${task.title}":`, {
        planned_date: task.planned_date,
        segments: taskSegments.length,
        segmentDates: taskSegments.map(s => s.date),
      });

      // If task has no segments, filter by planned_date
      if (taskSegments.length === 0) {
        if (!task.planned_date) {
          console.log(`[KANBAN] ❌ Task has no planned_date and no segments, excluding`);
          return false;
        }
        // Use planned_date's date directly (should already be YYYY-MM-DD format)
        const taskDate = task.planned_date.slice(0, 10);
        const inRange = taskDate >= startDate && taskDate <= endDate;
        console.log(`[KANBAN] ${inRange ? '✅' : '❌'} No segments, checking planned_date: ${taskDate}`);
        return inRange;
      }

      // If task has segments, include if ANY segment date is in range
      const hasSegmentInRange = taskSegments.some((seg) => {
        // Use start_time's date (ISO prefix) instead of the date field to avoid timezone issues
        const segDate = seg.start_time.slice(0, 10); // Extract YYYY-MM-DD from ISO string
        return segDate >= startDate && segDate <= endDate;
      });
      console.log(`[KANBAN] ${hasSegmentInRange ? '✅' : '❌'} Has segments, checking segment dates`);
      return hasSegmentInRange;
    });
  }, [tasks, dateRange, segmentsByTask]);

  // PRD: Group tasks by status
  const columns: KanbanColumn[] = useMemo(() => {
    return [
      {
        id: "todo",
        title: "📋 To Do",
        tasks: filteredTasks.filter((t) => t.status === "todo" || t.status === "backlog" || t.status === "planned"),
      },
      {
        id: "in_progress",
        title: "🔄 In Progress",
        tasks: filteredTasks.filter((t) => t.status === "in_progress"),
      },
      {
        id: "completed",
        title: "✅ Completed",
        tasks: filteredTasks.filter((t) => t.status === "completed"),
      },
    ];
  }, [filteredTasks]);

  const handleDragStart = (event: DragStartEvent) => {
    const taskId = event.active.id as string;
    const task = filteredTasks.find((t) => t.id === taskId);
    setActiveTask(task || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const taskId = active.id as string;
    const newStatus = over.id as string;

    // Validate status
    if (!["todo", "in_progress", "completed"].includes(newStatus)) return;

    const task = filteredTasks.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) return;

    try {
      // Map column IDs to task statuses
      let statusToSet: Task["status"] = "todo";
      if (newStatus === "in_progress") statusToSet = "in_progress";
      else if (newStatus === "completed") statusToSet = "completed";
      else if (newStatus === "todo") statusToSet = "todo";

      await updateTask(taskId, { status: statusToSet });
      toast({
        title: "Task updated",
        description: `Task moved to ${newStatus.replace("_", " ")}`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update task status",
      });
    }
  };

  // Format range label
  const rangeLabel = useMemo(() => {
    if (isSameDay(dateRange.start, dateRange.end)) {
      return format(dateRange.start, "MMM d, yyyy");
    }
    return `${format(dateRange.start, "MMM d")} - ${format(dateRange.end, "MMM d, yyyy")}`;
  }, [dateRange]);

  // Navigation handlers
  const navigatePrevious = () => {
    if (timeRange === "day") {
      setCurrentDate(addDays(currentDate, -1));
    } else {
      setCurrentDate(addWeeks(currentDate, -1));
    }
  };

  const navigateNext = () => {
    if (timeRange === "day") {
      setCurrentDate(addDays(currentDate, 1));
    } else {
      setCurrentDate(addWeeks(currentDate, 1));
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const goToThisWeek = () => {
    setTimeRange("week");
    setCurrentDate(new Date());
  };

  const handleCalendarSelect = (date: Date | undefined) => {
    if (date) {
      setCurrentDate(date);
      setCalendarOpen(false);
    }
  };

  // Build set of dates that have scheduled tasks (for indicator dots in date picker)
  const taskBoxDateSet = new Set<string>();
  for (const task of tasks) {
    if (task.status === "completed" || task.parent_task_id) {
      continue;
    }
    const boxDates = getTaskBoxDates(task, segmentsByTask);
    for (const d of boxDates) {
      const key = format(d, "yyyy-MM-dd");
      taskBoxDateSet.add(key);
    }
  }

  // Convert Set to array of Date objects for modifiers
  const datesWithTasks = Array.from(taskBoxDateSet).map((dateStr) => {
    return new Date(dateStr + 'T00:00:00');
  });

  return (
    <div className="space-y-6">
      <Card className="p-6 shadow-medium">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold">Kanban Board</h3>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Task
          </Button>
        </div>

        {/* Time Range Selector - Step 1: Choose Day/Week Mode */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Step 1: Day/Week Mode Selector */}
          <div className="flex items-center gap-2 border rounded-md p-1">
            <Button
              variant={timeRange === "day" ? "default" : "ghost"}
              size="sm"
              onClick={() => {
                setTimeRange("day");
                setCurrentDate(new Date());
              }}
            >
              Day
            </Button>
            <Button
              variant={timeRange === "week" ? "default" : "ghost"}
              size="sm"
              onClick={() => {
                setTimeRange("week");
                setCurrentDate(new Date());
              }}
            >
              Week
            </Button>
          </div>

          {/* Step 2: Quick Actions or Custom Selection */}
          <div className="flex items-center gap-2">
            {/* Quick Actions */}
            {timeRange === "day" ? (
              <Button
                variant={isSameDay(currentDate, new Date()) ? "default" : "outline"}
                size="sm"
                onClick={goToToday}
              >
                Today
              </Button>
            ) : (
              <Button
                variant={isSameDay(startOfWeek(currentDate), startOfWeek(new Date())) ? "default" : "outline"}
                size="sm"
                onClick={goToThisWeek}
              >
                This Week
              </Button>
            )}

            {/* Or Custom Selection */}
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <Calendar className="w-4 h-4" />
                  {timeRange === "day" ? "Select Date" : "Select Week"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={currentDate}
                  onSelect={handleCalendarSelect}
                  modifiers={{
                    hasTasks: datesWithTasks,
                  }}
                  modifiersClassNames={{
                    hasTasks: "relative after:content-[''] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1.5 after:h-1.5 after:bg-red-500 after:rounded-full",
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Navigation Arrows */}
          <div className="flex items-center gap-1 border rounded-md">
            <Button
              variant="ghost"
              size="sm"
              onClick={navigatePrevious}
              className="h-8 px-2"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            
            {/* Current Date/Week Display */}
            <div className="px-4 py-1 text-sm font-medium min-w-[200px] text-center">
              {timeRange === "day" ? (
                format(currentDate, "EEEE, MMM d, yyyy")
              ) : (
                `${format(startOfWeek(currentDate), "MMM d")} - ${format(endOfWeek(currentDate), "MMM d, yyyy")}`
              )}
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={navigateNext}
              className="h-8 px-2"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Task Count */}
          <div className="ml-auto text-sm text-muted-foreground">
            {filteredTasks.length} {filteredTasks.length === 1 ? "task" : "tasks"}
          </div>
        </div>
      </Card>

      {/* Kanban Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-3 gap-4">
          {columns.map((column) => (
            <div key={column.id} className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <h4 className="font-semibold">{column.title}</h4>
                <Badge variant="secondary">{column.tasks.length}</Badge>
              </div>
              <KanbanColumnDropZone columnId={column.id}>
                {column.tasks.map((task) => (
                  <KanbanTaskCard
                    key={task.id}
                    task={task}
                    onDoubleClick={() => {
                      // Get fresh task from global store to ensure we have latest data
                      const freshTask = tasks.find(t => t.id === task.id);
                      if (freshTask) {
                        setEditingTask(freshTask);
                        setDialogOpen(true);
                      }
                    }}
                  />
                ))}
                {column.tasks.length === 0 && (
                  <div className="text-center text-sm text-muted-foreground py-8">
                    No tasks
                  </div>
                )}
              </KanbanColumnDropZone>
            </div>
          ))}
        </div>

        <DragOverlay>
          {activeTask ? (
            <Card className="p-4 opacity-90 shadow-lg" style={{ width: "300px" }}>
              <h5 className="font-medium text-sm">{activeTask.title}</h5>
            </Card>
          ) : null}
        </DragOverlay>
      </DndContext>

      <TaskDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingTask(null);
        }}
        onSuccess={() => {
          // TaskDialog already refreshes taskStore internally
          // Just ensure local view is in sync
          fetchTasks();
        }}
        editTask={editingTask}
      />
    </div>
  );
};

