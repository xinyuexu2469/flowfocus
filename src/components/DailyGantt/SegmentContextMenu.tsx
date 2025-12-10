import React from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Edit,
  Copy,
  Calendar,
  CalendarPlus,
  Scissors,
  Trash2,
  Trash,
} from "lucide-react";
import { TimeSegment } from "@/types/timeSegment";
import { format, parseISO, addDays, startOfToday } from "date-fns";
import { useDailyGanttStore } from "@/stores/dailyGanttStore";
import { useToast } from "@/hooks/use-toast";

interface SegmentContextMenuProps {
  segment: TimeSegment;
  children: React.ReactNode;
  onEdit?: () => void;
}

export const SegmentContextMenu: React.FC<SegmentContextMenuProps> = ({
  segment,
  children,
  onEdit,
}) => {
  const {
    duplicateSegment,
    moveSegmentToToday,
    moveSegmentToTomorrow,
    splitSegment,
    deleteSegment,
    deleteAllSegmentsForTask,
  } = useDailyGanttStore();
  const { toast } = useToast();

  const handleDuplicate = async () => {
    try {
      await duplicateSegment(segment.id);
      toast({
        title: "Segment duplicated",
        description: "A copy has been created.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to duplicate segment",
      });
    }
  };

  const handleMoveToToday = async () => {
    try {
      await moveSegmentToToday(segment.id);
      toast({
        title: "Moved to today",
        description: "Segment has been moved to today.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to move segment",
      });
    }
  };

  const handleMoveToTomorrow = async () => {
    try {
      await moveSegmentToTomorrow(segment.id);
      toast({
        title: "Moved to tomorrow",
        description: "Segment has been moved to tomorrow.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to move segment",
      });
    }
  };

  const handleSplit = async () => {
    try {
      await splitSegment(segment.id);
      toast({
        title: "Segment split",
        description: "Segment has been split into two equal parts.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to split segment",
      });
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this segment?")) return;

    try {
      await deleteSegment(segment.id);
      toast({
        title: "Segment deleted",
        description: "The segment has been removed.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete segment",
      });
    }
  };

  const handleDeleteAll = async () => {
    if (
      !confirm(
        "Delete all segments for this task? This cannot be undone."
      )
    )
      return;

    try {
      await deleteAllSegmentsForTask(segment.task_id);
      toast({
        title: "All segments deleted",
        description: "All segments for this task have been removed.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete segments",
      });
    }
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        {/* === TIER 1: ESSENTIAL === */}
        <ContextMenuItem onClick={onEdit}>
          <Edit className="w-4 h-4 mr-2" />
          Edit Segment
        </ContextMenuItem>
        <ContextMenuItem onClick={handleDuplicate}>
          <Copy className="w-4 h-4 mr-2" />
          Duplicate
        </ContextMenuItem>

        <ContextMenuSeparator />

        {/* === TIER 2: QUICK ACTIONS === */}
        <ContextMenuItem onClick={handleMoveToToday}>
          <Calendar className="w-4 h-4 mr-2" />
          Move to Today
        </ContextMenuItem>
        <ContextMenuItem onClick={handleMoveToTomorrow}>
          <CalendarPlus className="w-4 h-4 mr-2" />
          Move to Tomorrow
        </ContextMenuItem>

        <ContextMenuSeparator />

        {/* === TIER 3: ADVANCED === */}
        <ContextMenuItem onClick={handleSplit}>
          <Scissors className="w-4 h-4 mr-2" />
          Split into 2 Segments
        </ContextMenuItem>

        <ContextMenuSeparator />

        {/* === TIER 4: DESTRUCTIVE === */}
        <ContextMenuItem
          onClick={handleDelete}
          className="text-red-600 focus:text-red-600"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Delete Segment
        </ContextMenuItem>
        <ContextMenuItem
          onClick={handleDeleteAll}
          className="text-red-600 focus:text-red-600"
        >
          <Trash className="w-4 h-4 mr-2" />
          Delete All Segments for Task
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};

