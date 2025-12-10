import React, { useRef, useState, useEffect } from "react";
import { Project } from "@/types/project";
import { useMonthlyGanttStore } from "@/stores/monthlyGanttStore";
import { format, parseISO, startOfWeek, endOfWeek } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface ProjectBarProps {
  project: Project;
  monthStart: Date;
  monthEnd: Date;
  weeks: Date[];
}

export const ProjectBar: React.FC<ProjectBarProps> = ({
  project,
  monthStart,
  monthEnd,
  weeks,
}) => {
  const { moveProjectBar, resizeProjectBar } = useMonthlyGanttStore();
  const { toast } = useToast();
  const barRef = useRef<HTMLDivElement>(null);

  const [dragState, setDragState] = useState<{
    type: "move" | "resize-left" | "resize-right" | null;
    startX: number;
    startDate: Date;
    endDate: Date;
  }>({
    type: null,
    startX: 0,
    startDate: new Date(),
    endDate: new Date(),
  });

  const [preview, setPreview] = useState<{
    startDate: Date;
    endDate: Date;
  } | null>(null);

  const startDate = parseISO(project.start_date);
  const deadline = parseISO(project.deadline);

  // Calculate position
  const weekStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const totalDays = Math.ceil(
    (weekEnd.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24)
  );

  const projectStartDays =
    (startDate.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24);
  const projectEndDays =
    (deadline.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24);
  const projectDuration = projectEndDays - projectStartDays;

  const leftPercent = (projectStartDays / totalDays) * 100;
  const widthPercent = (projectDuration / totalDays) * 100;

  // Priority colors - 使用设计系统颜色，不透明版本（降低亮度，增加饱和度）
  const priorityColors = {
    urgent: { bg: "bg-[hsl(0,55%,70%)]", border: "border-[hsl(0,55%,65%)]", hover: "hover:bg-[hsl(0,55%,72%)]" },
    high: { bg: "bg-[hsl(25,65%,70%)]", border: "border-[hsl(25,65%,65%)]", hover: "hover:bg-[hsl(25,65%,72%)]" },
    medium: { bg: "bg-[hsl(185,55%,65%)]", border: "border-[hsl(185,55%,60%)]", hover: "hover:bg-[hsl(185,55%,67%)]" },
    low: { bg: "bg-[hsl(210,20%,75%)]", border: "border-[hsl(210,20%,70%)]", hover: "hover:bg-[hsl(210,20%,77%)]" },
  };

  const colors = priorityColors[project.priority];

  // Mouse handlers
  const handleMouseDown = (
    e: React.MouseEvent,
    type: "move" | "resize-left" | "resize-right"
  ) => {
    e.preventDefault();
    e.stopPropagation();

    setDragState({
      type,
      startX: e.clientX,
      startDate: new Date(startDate),
      endDate: new Date(deadline),
    });
  };

  useEffect(() => {
    if (!dragState.type) return;

    const handleMouseMove = (e: MouseEvent) => {
      const container = barRef.current?.parentElement;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const deltaX = e.clientX - dragState.startX;
      const deltaDays = (deltaX / containerRect.width) * totalDays;

      // Snap to days
      const snappedDelta = Math.round(deltaDays);

      if (dragState.type === "move") {
        const newStart = new Date(dragState.startDate);
        newStart.setDate(newStart.getDate() + snappedDelta);

        const duration =
          dragState.endDate.getTime() - dragState.startDate.getTime();
        const newEnd = new Date(newStart.getTime() + duration);

        setPreview({ startDate: newStart, endDate: newEnd });
      } else if (dragState.type === "resize-left") {
        const newStart = new Date(dragState.startDate);
        newStart.setDate(newStart.getDate() + snappedDelta);

        if (newStart < dragState.endDate) {
          setPreview({ startDate: newStart, endDate: dragState.endDate });
        }
      } else if (dragState.type === "resize-right") {
        const newEnd = new Date(dragState.endDate);
        newEnd.setDate(newEnd.getDate() + snappedDelta);

        if (newEnd > dragState.startDate) {
          setPreview({ startDate: dragState.startDate, endDate: newEnd });
        }
      }
    };

    const handleMouseUp = async () => {
      if (preview) {
        // Store the preview values before clearing state
        const previewStart = new Date(preview.startDate);
        const previewEnd = new Date(preview.endDate);
        const dragType = dragState.type;

        // Clear drag state immediately but keep preview until update completes
        setDragState({
          type: null,
          startX: 0,
          startDate: new Date(),
          endDate: new Date(),
        });

        try {
          // Update the project via API
          if (dragType === "move") {
            await moveProjectBar(project.id, previewStart);
          } else {
            await resizeProjectBar(project.id, previewStart, previewEnd);
          }

          // Clear preview only after successful update
          setPreview(null);

          toast({
            title: "Project updated",
            description: "Your project timeline has been updated.",
          });
        } catch (error: any) {
          // Revert preview on error
          setPreview(null);
          toast({
            variant: "destructive",
            title: "Error",
            description: error.message,
          });
        }
      } else {
        // No preview means no changes were made
        setDragState({
          type: null,
          startX: 0,
          startDate: new Date(),
          endDate: new Date(),
        });
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragState, preview, project.id, moveProjectBar, resizeProjectBar, totalDays, toast]);

  // Calculate preview position
  const displayStart = preview?.startDate || startDate;
  const displayEnd = preview?.endDate || deadline;

  const displayStartDays =
    (displayStart.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24);
  const displayEndDays =
    (displayEnd.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24);
  const displayDuration = displayEndDays - displayStartDays;

  const previewLeft = (displayStartDays / totalDays) * 100;
  const previewWidth = (displayDuration / totalDays) * 100;

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

      {/* Project bar */}
      <div
        ref={barRef}
        className={`
          absolute top-2 bottom-2
          ${colors.bg} ${colors.border} border-2
          text-white rounded shadow-md
          ${colors.hover}
          transition-all
          cursor-grab active:cursor-grabbing
          ${dragState.type ? "z-20 shadow-2xl scale-105" : "z-10"}
          ${preview ? "opacity-90" : "opacity-100"}
        `}
        style={{
          left: `${previewLeft}%`,
          width: `${previewWidth}%`,
          minWidth: "40px",
        }}
        onMouseDown={(e) => handleMouseDown(e, "move")}
        title={`${project.name}\n${format(displayStart, "MMM d")} - ${format(displayEnd, "MMM d")}`}
      >
        {/* Left resize handle */}
        <div
          className="absolute top-0 bottom-0 left-0 w-2 cursor-ew-resize z-30"
          onMouseDown={(e) => {
            e.stopPropagation();
            handleMouseDown(e, "resize-left");
          }}
        />

        {/* Right resize handle */}
        <div
          className="absolute top-0 bottom-0 right-0 w-2 cursor-ew-resize z-30"
          onMouseDown={(e) => {
            e.stopPropagation();
            handleMouseDown(e, "resize-right");
          }}
        />

        {/* Content */}
        <div className="px-2 py-1 h-full flex items-center pointer-events-none text-xs">
          {previewWidth > 8 && (
            <div className="truncate font-medium">
              {project.name}
            </div>
          )}
        </div>
      </div>

      {/* Live tooltip during drag */}
      {preview && dragState.type && (
        <div
          className="fixed bg-gray-900 text-white px-3 py-2 rounded shadow-lg z-50 text-sm pointer-events-none"
          style={{
            left: dragState.startX + 20,
            top: 100,
          }}
        >
          <div className="font-medium">{project.name}</div>
          <div>
            {format(preview.startDate, "MMM d")} - {format(preview.endDate, "MMM d")}
          </div>
        </div>
      )}
    </>
  );
};

