import React, { useRef, useState, useEffect } from "react";
import { DndContext, DragOverlay, closestCenter, useDroppable, DragStartEvent, DragMoveEvent, DragEndEvent } from "@dnd-kit/core";
import { useDailyGanttStore } from "@/stores/dailyGanttStore";
import { TimelineHeader } from "./TimelineHeader";
import { TimeBlock } from "./TimeBlock";
import { format, parseISO, addHours } from "date-fns";
import { useToast } from "@/hooks/use-toast";

// DISABLED: Sidebar drag-to-timeline feature to prevent page freeze
const ENABLE_SIDEBAR_DRAG_CREATE = false;

interface GanttRow {
  taskId: string;
  task: any;
  segments: any[];
  subtasks?: Array<{ task: any; segments: any[] }>;
}

interface UnifiedTimelinePanelProps {
  ganttRows: GanttRow[];
  scrollRef?: React.RefObject<HTMLDivElement>;
  syncScrollRef?: React.RefObject<HTMLDivElement>;
  isScrollingRef?: React.MutableRefObject<boolean>;
}

export const UnifiedTimelinePanel: React.FC<UnifiedTimelinePanelProps> = ({
  ganttRows,
  scrollRef,
  syncScrollRef,
  isScrollingRef,
}) => {
  const { createSegmentFromDrop } = useDailyGanttStore();
  const { toast } = useToast();
  const timelineRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const internalScrollRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = scrollRef || internalScrollRef;
  
  // Use timelineRef for both position calculation and scroll sync if no external ref provided
  const actualScrollRef = scrollRef || timelineRef;
  const [pixelsPerHour, setPixelsPerHour] = useState(80);
  const [activeTask, setActiveTask] = useState<any>(null);
  const [dragPreview, setDragPreview] = useState<{
    taskId: string;
    startTime: Date;
    endTime: Date;
    x: number;
  } | null>(null);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  // Calculate timeline config
  const startHour = 0; // 12am (midnight)
  const endHour = 24; // 12am next day (full 24 hours)
  const totalHours = endHour - startHour;

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(timer);
  }, []);

  // Sync header horizontal scroll with content
  useEffect(() => {
    const contentElement = timelineRef.current;
    const headerElement = headerRef.current;
    
    if (!contentElement || !headerElement) return;

    const handleScroll = () => {
      headerElement.scrollLeft = contentElement.scrollLeft;
    };

    contentElement.addEventListener('scroll', handleScroll);
    return () => contentElement.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (timelineRef.current) {
      const width = timelineRef.current.offsetWidth;
      setPixelsPerHour(width / totalHours);
    }
  }, [totalHours]);

  const { selectedDate } = useDailyGanttStore();

  // Calculate current time position on timeline
  const calculateCurrentTimePosition = () => {
    const now = currentTime;
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const totalMinutes = currentHour * 60 + currentMinute;
    const timelineStartMinutes = startHour * 60;
    const timelineTotalMinutes = totalHours * 60;
    
    return ((totalMinutes - timelineStartMinutes) / timelineTotalMinutes) * 100;
  };

  // Check if current time indicator should be shown
  const isToday = selectedDate.toDateString() === new Date().toDateString();
  const currentTimePosition = calculateCurrentTimePosition();
  const showCurrentTime = isToday && currentTimePosition >= 0 && currentTimePosition <= 100;

  // Sync scroll with task list panel
  useEffect(() => {
    const scrollContainer = actualScrollRef.current;
    const syncContainer = syncScrollRef?.current;

    if (!scrollContainer || !syncContainer || !isScrollingRef) return;

    const handleScroll = () => {
      if (isScrollingRef.current) return; // Prevent infinite loop
      
      isScrollingRef.current = true;
      syncContainer.scrollTop = scrollContainer.scrollTop;
      
      // Reset flag after a short delay
      requestAnimationFrame(() => {
        isScrollingRef.current = false;
      });
    };

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll);
    };
  }, [actualScrollRef, syncScrollRef, isScrollingRef]);

  // DISABLED: Handle drag from task list
  const handleDragStart = (event: DragStartEvent) => {
    if (!ENABLE_SIDEBAR_DRAG_CREATE) {
      setActiveTask(null);
      setDragPreview(null);
      return;
    }
    
    const data = event.active.data.current;
    if (data?.type === "task") {
      setActiveTask(data.task);
    }
  };

  const handleDragMove = (event: DragMoveEvent) => {
    if (!ENABLE_SIDEBAR_DRAG_CREATE) {
      return;
    }
    
    if (!activeTask || !timelineRef.current) return;

    const delta = event.delta;
    if (!delta) return;

    // Get mouse position relative to timeline
    const containerRect = timelineRef.current.getBoundingClientRect();
    const mouseEvent = event.activatorEvent as MouseEvent;
    if (!mouseEvent) return;

    const x = mouseEvent.clientX - containerRect.left;
    const clampedX = Math.max(0, Math.min(x, containerRect.width));
    const hours = (clampedX / containerRect.width) * totalHours;
    const minutes = Math.round((hours % 1) * 60 / 15) * 15; // Snap to 15 min
    const snappedHours = Math.floor(hours) + minutes / 60;

    const startTime = new Date(selectedDate);
    startTime.setHours(startHour + Math.floor(snappedHours), minutes % 60, 0, 0);

    // Ensure within day bounds
    const dayStart = new Date(selectedDate);
    dayStart.setHours(startHour, 0, 0, 0);
    const dayEnd = new Date(selectedDate);
    dayEnd.setHours(endHour, 0, 0, 0);

    if (startTime < dayStart) startTime.setTime(dayStart.getTime());
    if (startTime >= dayEnd) startTime.setTime(dayEnd.getTime() - 60 * 60 * 1000); // 1 hour before end

    const endTime = addHours(startTime, 1); // Fixed 1-hour duration

    setDragPreview({
      taskId: activeTask.id,
      startTime,
      endTime,
      x: mouseEvent.clientX,
    });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    if (!ENABLE_SIDEBAR_DRAG_CREATE) {
      setActiveTask(null);
      setDragPreview(null);
      return;
    }
    
    const { active, over } = event;

    if (over && over.id?.toString().startsWith('timeline-row-') && dragPreview) {
      const taskId = over.id.toString().replace('timeline-row-', '');
      
      // Only allow drop on same task's row
      if (taskId === activeTask?.id) {
        try {
          await createSegmentFromDrop(activeTask.id, dragPreview.startTime);

          // Refresh calendar events to show new segment
          try {
            const { useCalendarStore } = await import("@/stores/calendarStore");
            const calendarStore = useCalendarStore.getState();
            const now = new Date();
            const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const end = new Date(now.getFullYear(), now.getMonth() + 2, 0);
            await calendarStore.fetchEvents(start, end);
          } catch (calendarError) {
            console.warn('Failed to refresh calendar events:', calendarError);
          }

          toast({
            title: "Segment created",
            description: `Scheduled at ${format(dragPreview.startTime, "h:mm a")} and synced to calendar.`,
          });
        } catch (error: any) {
          toast({
            variant: "destructive",
            title: "Error",
            description: error.message || "Failed to create segment",
          });
        }
      }
    }

    setActiveTask(null);
    setDragPreview(null);
  };

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
    >
      <div className="unified-timeline-panel h-full flex flex-col bg-background">
        {/* Timeline Header - Syncs horizontal scroll with content */}
        <TimelineHeader 
          startHour={startHour} 
          endHour={endHour} 
          headerRef={headerRef}
        />

        {/* Timeline Grid - Perfect 1:1 alignment with task list */}
        <div
          ref={(node) => {
            timelineRef.current = node;
            if (actualScrollRef && node) {
              (actualScrollRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
            }
          }}
          className="flex-1 overflow-x-auto overflow-y-auto relative"
          style={{ minWidth: '100%' }}
        >
          {/* Hour grid lines */}
          <div className="absolute inset-0 pointer-events-none" style={{ minWidth: `${totalHours * 100}px` }}>
            {Array.from({ length: totalHours + 1 }, (_, i) => {
              const hour = startHour + i;
              const leftPercent = (i / totalHours) * 100;
              return (
                <div
                  key={hour}
                  className="absolute top-0 bottom-0 border-l border-border/50"
                  style={{ left: `${leftPercent}%` }}
                />
              );
            })}

            {/* Current time indicator - Red line */}
            {showCurrentTime && (
              <div
                className="absolute top-0 bottom-0 pointer-events-none z-30"
                style={{ left: `${currentTimePosition}%` }}
              >
                {/* Red line */}
                <div className="absolute top-0 bottom-0 w-0.5 bg-[hsl(0,45%,75%)]" />
                
                {/* Red circle at top */}
                <div className="absolute -top-1 -left-1.5 w-3 h-3 rounded-full bg-[hsl(0,45%,75%)]" />
                
                {/* Time label */}
                <div className="absolute top-4 -left-8 bg-[hsl(0,45%,75%)] text-white text-xs px-2 py-0.5 rounded whitespace-nowrap">
                  {currentTime.toLocaleTimeString('en-US', { 
                    hour: 'numeric', 
                    minute: '2-digit',
                    hour12: true 
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Task rows - 1:1 aligned */}
          <div className="relative" style={{ minWidth: `${totalHours * 100}px` }}>
            {ganttRows.map((row, index) => (
              <TimelineRow
                key={row.taskId}
                row={row}
                rowIndex={index}
                timelineConfig={{
                  startHour,
                  endHour,
                  totalHours,
                  pixelsPerHour,
                }}
                selectedDate={selectedDate}
                dragPreview={activeTask?.id === row.taskId ? dragPreview : null}
              />
            ))}

            {/* Empty state */}
            {ganttRows.length === 0 && (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                <div className="text-center">
                  <p className="text-sm">No tasks for this day</p>
                  <p className="text-xs mt-2">Drag tasks here to schedule</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* DISABLED: Drag overlay for sidebar drag-to-timeline feature */}
        {ENABLE_SIDEBAR_DRAG_CREATE && (
          <DragOverlay>
            {activeTask && dragPreview && (
              <div
                className="fixed bg-blue-500 text-white px-3 py-2 rounded shadow-lg z-50 text-sm pointer-events-none"
                style={{
                  left: dragPreview.x + 20,
                  top: 100,
                }}
              >
                <div className="font-medium">{activeTask.title}</div>
                <div>
                  {format(dragPreview.startTime, "h:mm a")} -{" "}
                  {format(dragPreview.endTime, "h:mm a")}
                </div>
                <div className="text-blue-200">Duration: 1h</div>
              </div>
            )}
          </DragOverlay>
        )}
      </div>
    </DndContext>
  );
};

interface TimelineRowProps {
  row: GanttRow;
  rowIndex: number;
  timelineConfig: {
    startHour: number;
    endHour: number;
    totalHours: number;
    pixelsPerHour: number;
  };
  selectedDate: Date;
  dragPreview?: {
    taskId: string;
    startTime: Date;
    endTime: Date;
    x: number;
  } | null;
}

const TimelineRow: React.FC<TimelineRowProps> = ({
  row,
  rowIndex,
  timelineConfig,
  selectedDate,
  dragPreview,
}) => {
  console.log(`📍 [TimelineRow ${rowIndex}] Rendering:`, {
    taskId: row.taskId,
    taskTitle: row.task?.title || 'Unknown',
    segmentCount: row.segments.length,
    hasSubtasks: !!row.subtasks && row.subtasks.length > 0,
  });

  const { setNodeRef, isOver } = useDroppable({
    id: `timeline-row-${row.taskId}`,
    data: {
      type: "timeline-row",
      taskId: row.taskId,
    },
  });

  // Calculate position for segments
  const calculatePosition = (startTime: Date) => {
    const startMinutes = startTime.getHours() * 60 + startTime.getMinutes();
    const timelineStartMinutes = timelineConfig.startHour * 60;
    const timelineTotalMinutes = timelineConfig.totalHours * 60;
    return ((startMinutes - timelineStartMinutes) / timelineTotalMinutes) * 100;
  };

  const calculateWidth = (startTime: Date, endTime: Date) => {
    const startMinutes = startTime.getHours() * 60 + startTime.getMinutes();
    const endMinutes = endTime.getHours() * 60 + endTime.getMinutes();
    const timelineTotalMinutes = timelineConfig.totalHours * 60;
    return ((endMinutes - startMinutes) / timelineTotalMinutes) * 100;
  };

  // Calculate preview position if dragging
  const previewLeft = dragPreview ? (() => {
    const startMinutes = dragPreview.startTime.getHours() * 60 + dragPreview.startTime.getMinutes();
    const timelineStartMinutes = timelineConfig.startHour * 60;
    const timelineTotalMinutes = timelineConfig.totalHours * 60;
    return ((startMinutes - timelineStartMinutes) / timelineTotalMinutes) * 100;
  })() : 0;

  const previewWidth = dragPreview ? (() => {
    const startMinutes = dragPreview.startTime.getHours() * 60 + dragPreview.startTime.getMinutes();
    const endMinutes = dragPreview.endTime.getHours() * 60 + dragPreview.endTime.getMinutes();
    const timelineTotalMinutes = timelineConfig.totalHours * 60;
    return ((endMinutes - startMinutes) / timelineTotalMinutes) * 100;
  })() : 0;

  return (
    <div
      ref={setNodeRef}
      className={`
        timeline-row h-16 border-b border-border/50 relative
        ${isOver ? "bg-blue-50/50 dark:bg-blue-950/20" : ""}
      `}
    >
      {/* Drag preview block */}
      {dragPreview && (
        <div
          className="absolute top-2 bottom-2 rounded border-2 border-dashed border-blue-500 bg-blue-500/20 pointer-events-none z-30"
          style={{
            left: `${previewLeft}%`,
            width: `${previewWidth}%`,
          }}
        >
          <div className="h-full flex items-center justify-center text-xs font-medium text-blue-700 dark:text-blue-300">
            {format(dragPreview.startTime, "h:mm a")} - {format(dragPreview.endTime, "h:mm a")}
          </div>
        </div>
      )}

      {/* Time blocks for this task */}
      {row.segments.map((segment, segIdx) => {
        console.log(`  ⏱️ [TimelineRow ${rowIndex}] Rendering TimeBlock ${segIdx}:`, {
          segmentId: segment.id.substring(0, 8),
          start: segment.start_time,
          end: segment.end_time,
        });
        return (
          <TimeBlock
            key={segment.id}
            segment={segment}
            taskTitle={row.task.title}
            taskPriority={row.task.priority}
            timelineConfig={timelineConfig}
            selectedDate={selectedDate}
          />
        );
      })}

      {/* Subtask segments (on same row) */}
      {row.subtasks &&
        row.subtasks.map((subtask) =>
          subtask.segments.map((segment) => (
            <TimeBlock
              key={segment.id}
              segment={segment}
              taskTitle={subtask.task.title}
              taskPriority={subtask.task.priority}
              timelineConfig={timelineConfig}
              selectedDate={selectedDate}
            />
          ))
        )}
    </div>
  );
};

