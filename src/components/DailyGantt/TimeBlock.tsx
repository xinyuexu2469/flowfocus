import React, { useRef, useState, useEffect } from "react";
import { TimeSegment } from "@/types/timeSegment";
import { useDailyGanttStore } from "@/stores/dailyGanttStore";
import { format, parseISO } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { SegmentContextMenu } from "./SegmentContextMenu";
import { TimeSegmentEditor } from "./TimeSegmentEditor";

interface TimeBlockProps {
  segment: TimeSegment;
  taskTitle: string;
  taskPriority: "urgent" | "low" | "medium" | "high";
  timelineConfig: {
    startHour: number;
    endHour: number;
    totalHours: number;
    pixelsPerHour: number;
  };
  selectedDate: Date;
}

export const TimeBlock: React.FC<TimeBlockProps> = ({
  segment,
  taskTitle,
  taskPriority,
  timelineConfig,
  selectedDate,
}) => {
  const { updateSegment, toggleSegmentSelection, selectedSegmentIds } = useDailyGanttStore();
  const { toast } = useToast();
  const blockRef = useRef<HTMLDivElement>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  const [dragState, setDragState] = useState<{
    type: "move" | "resize-left" | "resize-right" | null;
    pointerId: number | null;
    startX: number;
    startTime: Date;
    startEnd: Date;
  }>({
    type: null,
    pointerId: null,
    startX: 0,
    startTime: new Date(),
    startEnd: new Date(),
  });

  const [preview, setPreview] = useState<{
    startTime: Date;
    endTime: Date;
  } | null>(null);

  // Optimistic update: store the locally updated segment
  const [optimisticSegment, setOptimisticSegment] = useState<{
    start_time: string;
    end_time: string;
  } | null>(null);

  // Use optimistic segment if available, otherwise use prop
  const currentSegment = optimisticSegment || {
    start_time: segment.start_time,
    end_time: segment.end_time,
  };

  // Calculate position - MUST come before debug logs that use these variables!
  const start = parseISO(currentSegment.start_time);
  const end = parseISO(currentSegment.end_time);

  // Debug: Calculate and log render position
  const debugStartMinutes = start.getHours() * 60 + start.getMinutes();
  const debugEndMinutes = end.getHours() * 60 + end.getMinutes();
  const debugLeft = ((debugStartMinutes - (timelineConfig.startHour * 60)) / (timelineConfig.totalHours * 60)) * 100;
  const debugWidth = ((debugEndMinutes - debugStartMinutes) / (timelineConfig.totalHours * 60)) * 100;
  
  console.log('🎨 [TimeBlock] Rendering:', {
    segmentId: segment.id.substring(0, 8),
    taskTitle: segment.task?.title || 'Unknown',
    isOptimistic: !!optimisticSegment,
    currentTime: `${start.toLocaleTimeString()} - ${end.toLocaleTimeString()}`,
    position: `left: ${debugLeft.toFixed(1)}%, width: ${debugWidth.toFixed(1)}%`,
    originalStart: segment.start_time,
    hasPreview: !!preview,
  });

  // Clear optimistic update when segment prop catches up
  useEffect(() => {
    if (optimisticSegment &&
        segment.start_time === optimisticSegment.start_time &&
        segment.end_time === optimisticSegment.end_time) {
      console.log('[TimeBlock] ✅ Server confirmed update, clearing optimistic state');
      setOptimisticSegment(null);
    }
  }, [segment.start_time, segment.end_time, optimisticSegment]);

  const startMinutes = start.getHours() * 60 + start.getMinutes();
  const endMinutes = end.getHours() * 60 + end.getMinutes();
  const timelineStartMinutes = timelineConfig.startHour * 60;
  const timelineTotalMinutes = timelineConfig.totalHours * 60;

  const leftPercent =
    ((startMinutes - timelineStartMinutes) / timelineTotalMinutes) * 100;
  const widthPercent =
    ((endMinutes - startMinutes) / timelineTotalMinutes) * 100;

  const displayStart = preview?.startTime || start;
  const displayEnd = preview?.endTime || end;

  // Priority colors - 使用设计系统颜色，不透明版本（降低亮度，增加饱和度）
  const priorityColors = {
    urgent: { 
      bg: "bg-[hsl(0,55%,70%)]", 
      border: "border-[hsl(0,55%,65%)]", 
      hover: "hover:bg-[hsl(0,55%,72%)]" 
    },
    high: { 
      bg: "bg-[hsl(25,65%,70%)]", 
      border: "border-[hsl(25,65%,65%)]", 
      hover: "hover:bg-[hsl(25,65%,72%)]" 
    },
    medium: { 
      bg: "bg-[hsl(185,55%,65%)]", 
      border: "border-[hsl(185,55%,60%)]", 
      hover: "hover:bg-[hsl(185,55%,67%)]" 
    },
    low: { 
      bg: "bg-[hsl(210,20%,75%)]", 
      border: "border-[hsl(210,20%,70%)]", 
      hover: "hover:bg-[hsl(210,20%,77%)]" 
    },
  };

  const colors = priorityColors[taskPriority];

  const snapMinutes = 15;

  const handlePointerDown = (
    e: React.PointerEvent,
    type: "move" | "resize-left" | "resize-right"
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const pointerId = e.pointerId;
    blockRef.current?.setPointerCapture(pointerId);

    document.body.style.userSelect = "none";
    document.body.style.cursor = type === "move" ? "grabbing" : "ew-resize";

    setDragState({
      type,
      pointerId,
      startX: e.clientX,
      startTime: new Date(start),
      startEnd: new Date(end),
    });

    console.log("[TimeBlock] 🖱️ Drag started:", {
      type,
      startTime: start.toLocaleTimeString(),
      endTime: end.toLocaleTimeString(),
    });
  };

  const applyDragDelta = (snappedDelta: number) => {
    const dayStart = new Date(selectedDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(selectedDate);
    dayEnd.setHours(23, 59, 59, 999);

    if (dragState.type === "move") {
      const newStart = new Date(dragState.startTime);
      newStart.setMinutes(newStart.getMinutes() + snappedDelta);

      const duration =
        dragState.startEnd.getTime() - dragState.startTime.getTime();
      const newEnd = new Date(newStart.getTime() + duration);

      if (newStart < dayStart) {
        newStart.setTime(dayStart.getTime());
        newEnd.setTime(newStart.getTime() + duration);
      }
      if (newEnd > dayEnd) {
        newEnd.setTime(dayEnd.getTime());
        newStart.setTime(newEnd.getTime() - duration);
      }

      setPreview({ startTime: newStart, endTime: newEnd });
    } else if (dragState.type === "resize-left") {
      // Resize from left edge: adjust start time, keep end fixed
      const newStart = new Date(dragState.startTime);
      newStart.setMinutes(newStart.getMinutes() + snappedDelta);

      if (newStart < dayStart) {
        newStart.setTime(dayStart.getTime());
      }
      // Ensure minimum 15-minute duration
      const minEnd = new Date(newStart);
      minEnd.setMinutes(minEnd.getMinutes() + 15);
      if (newStart < dragState.startEnd && newStart >= dayStart && minEnd <= dragState.startEnd) {
        setPreview({ startTime: newStart, endTime: dragState.startEnd });
      }
    } else if (dragState.type === "resize-right") {
      // Resize from right edge: adjust end time, keep start fixed
      const newEnd = new Date(dragState.startEnd);
      newEnd.setMinutes(newEnd.getMinutes() + snappedDelta);

      if (newEnd > dayEnd) {
        newEnd.setTime(dayEnd.getTime());
      }
      // Ensure minimum 15-minute duration
      const minStart = new Date(newEnd);
      minStart.setMinutes(minStart.getMinutes() - 15);
      if (newEnd > dragState.startTime && newEnd <= dayEnd && minStart >= dragState.startTime) {
        setPreview({ startTime: dragState.startTime, endTime: newEnd });
      }
    }
  };

  const handlePointerMove = (pointerEvent: PointerEvent) => {
    if (!dragState.type || dragState.pointerId !== pointerEvent.pointerId) {
      return;
    }

    const container = blockRef.current?.parentElement;
    if (!container) return;

    pointerEvent.preventDefault();

    const containerRect = container.getBoundingClientRect();
    const deltaX = pointerEvent.clientX - dragState.startX;
    const deltaMinutesRaw =
      (deltaX / containerRect.width) *
      (timelineConfig.totalHours * 60);
    const snapInterval = pointerEvent.shiftKey ? 1 : snapMinutes;
    const snappedDelta =
      Math.round(deltaMinutesRaw / snapInterval) * snapInterval;

    applyDragDelta(snappedDelta);
  };

  const commitPointerUp = async () => {
    document.body.style.userSelect = "";
    document.body.style.cursor = "";

    if (preview) {
      const newStartTime = preview.startTime.toISOString();
      const newEndTime = preview.endTime.toISOString();

      // Set optimistic update immediately to keep UI responsive
      setOptimisticSegment({
        start_time: newStartTime,
        end_time: newEndTime,
      });

      // Clear drag state but keep preview until update completes
      setDragState({
        type: null,
        pointerId: null,
        startX: 0,
        startTime: new Date(),
        startEnd: new Date(),
      });

      try {
        // Update the segment via API - store updates optimistically, so UI stays in place
        await updateSegment(segment.id, {
          start_time: newStartTime,
          end_time: newEndTime,
        });

        // Clear preview and optimistic state - store already has the update
        setPreview(null);
        // Keep optimisticSegment until segment prop updates (handled by useEffect)

        // Show success toast (don't wait for background syncs)
        toast({
          title: "Saved",
          description: "Time block updated successfully.",
        });
      } catch (error: any) {
        console.error("[TimeBlock] ❌ Server sync failed, reverting...", error);
        // Revert optimistic update on error
        setOptimisticSegment(null);
        setPreview(null);
        toast({
          variant: "destructive",
          title: "Update failed",
          description: "Changes were reverted. Please try again.",
        });
      }
    } else {
      // No preview means no changes were made
      setDragState({
        type: null,
        pointerId: null,
        startX: 0,
        startTime: new Date(),
        startEnd: new Date(),
      });
    }
  };

  useEffect(() => {
    if (!dragState.type || dragState.pointerId === null) return;

    const moveListener = (event: PointerEvent) => handlePointerMove(event);
    const upListener = (event: PointerEvent) => {
      if (event.pointerId !== dragState.pointerId) return;
      blockRef.current?.releasePointerCapture(event.pointerId);
      commitPointerUp();
    };

    window.addEventListener("pointermove", moveListener, { passive: false });
    window.addEventListener("pointerup", upListener);
    window.addEventListener("pointercancel", upListener);

    return () => {
      window.removeEventListener("pointermove", moveListener);
      window.removeEventListener("pointerup", upListener);
      window.removeEventListener("pointercancel", upListener);
    };
  }, [
    dragState.pointerId,
    dragState.type,
    dragState.startX,
    dragState.startTime,
    dragState.startEnd,
    snapMinutes,
    preview,
    selectedDate,
    segment.id,
    updateSegment,
    toast,
  ]);

  // Format time
  const formatTime = (date: Date) => format(date, "h:mma").toLowerCase();
  const duration =
    (displayEnd.getTime() - displayStart.getTime()) / (1000 * 60);
  const durationText =
    duration >= 60
      ? `${Math.floor(duration / 60)}h ${duration % 60}m`
      : `${duration}m`;

  // Calculate preview position
  const previewLeft =
    preview
      ? ((displayStart.getHours() * 60 +
          displayStart.getMinutes() -
          timelineStartMinutes) /
          timelineTotalMinutes) *
        100
      : leftPercent;

  const previewWidth = preview
    ? ((displayEnd.getTime() - displayStart.getTime()) /
        (1000 * 60) /
        timelineTotalMinutes) *
      100
    : widthPercent;

  return (
    <>
      {/* Ghost preview when dragging */}
      {preview && (
        <div
          className={`absolute top-2 bottom-2 rounded ${colors.bg} opacity-30 pointer-events-none`}
          style={{
            left: `${leftPercent}%`,
            width: `${widthPercent}%`,
          }}
        />
      )}

      {/* Time block - wrapped in context menu */}
      <SegmentContextMenu segment={segment} onEdit={() => setEditorOpen(true)}>
        <div
          ref={blockRef}
          className={`
            absolute top-2 bottom-2
            ${colors.bg} ${colors.border} border-2
            text-white rounded shadow-md
            ${colors.hover}
            transition-all
            cursor-grab active:cursor-grabbing
            ${dragState.type ? "z-20 shadow-2xl scale-105" : "z-10"}
            ${preview ? "opacity-90" : "opacity-100"}
            ${selectedSegmentIds.has(segment.id) ? "ring-2 ring-blue-500 ring-offset-1" : ""}
          `}
          style={{
            left: `${previewLeft}%`,
            width: `${previewWidth}%`,
            minWidth: "40px",
            touchAction: "none",
          }}
          onPointerDown={(e) => {
            // Multi-select: Ctrl/Cmd + click
            if (e.ctrlKey || e.metaKey) {
              e.preventDefault();
              toggleSegmentSelection(segment.id);
              return;
            }
            handlePointerDown(e, "move");
          }}
          onDoubleClick={() => setEditorOpen(true)}
          title={`${taskTitle} - Session ${segment.order || 1}\n${formatTime(displayStart)} - ${formatTime(displayEnd)}\nDuration: ${durationText}`}
        >
          {/* Left resize handle (start time) */}
          <div
            className="absolute top-0 bottom-0 left-0 w-3 cursor-ew-resize z-30 hover:bg-white/20"
            onPointerDown={(e) => {
              e.stopPropagation();
              handlePointerDown(e, "resize-left");
            }}
          />

          {/* Right resize handle (end time) */}
          <div
            className="absolute top-0 bottom-0 right-0 w-3 cursor-ew-resize z-30 hover:bg-white/20"
            onPointerDown={(e) => {
              e.stopPropagation();
              handlePointerDown(e, "resize-right");
            }}
          />

          {/* Content */}
          <div className="px-2 py-1 h-full flex flex-col justify-center pointer-events-none text-xs">
            {previewWidth > 8 && (
              <>
                <div className="font-medium truncate">
                  Session {segment.order || 1}
                </div>
                <div className="truncate text-[10px] opacity-90">
                  {formatTime(displayStart)} - {formatTime(displayEnd)}
                </div>
                {previewWidth > 12 && (
                  <div className="text-[10px] opacity-75">{durationText}</div>
                )}
              </>
            )}
          </div>
        </div>
      </SegmentContextMenu>

      {/* Live tooltip during drag */}
      {preview && dragState.type && (
        <div
          className="fixed bg-gray-900 text-white px-3 py-2 rounded shadow-lg z-50 text-sm pointer-events-none"
          style={{
            left: dragState.startX + 20,
            top: 100,
          }}
        >
          <div className="font-medium">{taskTitle}</div>
          <div>
            {formatTime(preview.startTime)} - {formatTime(preview.endTime)}
          </div>
          <div className="text-gray-300">Duration: {durationText}</div>
          <div className="text-xs text-gray-400 mt-1">
            {dragState.type === "move" ? "🔄 Moving" : dragState.type === "resize-left" ? "⬅️ Resizing start" : "➡️ Resizing end"} • Hold Shift for 1min precision
          </div>
        </div>
      )}

      {/* Editor Dialog */}
      <TimeSegmentEditor
        segment={segment}
        open={editorOpen}
        onOpenChange={setEditorOpen}
      />
    </>
  );
};

