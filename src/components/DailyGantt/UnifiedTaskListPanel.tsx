import React, { useState, useEffect, useRef } from "react";
import { DndContext, closestCenter, DragEndEvent } from "@dnd-kit/core";
// import { useDraggable } from "@dnd-kit/core"; // DISABLED: Sidebar drag-to-timeline feature
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTaskStore } from "@/stores/taskStore";
import { GripVertical, ChevronDown, ChevronRight, ChevronLeft } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TaskDialog } from "@/components/TaskDialog";

// DISABLED: Sidebar drag-to-timeline feature to prevent page freeze
const ENABLE_SIDEBAR_DRAG_CREATE = false;

interface GanttRow {
  taskId: string;
  task: any;
  segments: any[];
  subtasks?: Array<{ task: any; segments: any[] }>;
}

interface UnifiedTaskListPanelProps {
  ganttRows: GanttRow[];
  onTaskReorder: (sourceIndex: number, destIndex: number) => void;
  expandedTaskIds: Set<string>;
  onToggleExpand: (taskId: string) => void;
  onTaskEdit?: (task: any) => void;
  onCollapse?: () => void;
  scrollRef?: React.RefObject<HTMLDivElement>;
  syncScrollRef?: React.RefObject<HTMLDivElement>;
  isScrollingRef?: React.MutableRefObject<boolean>;
}

const SortableTaskRow: React.FC<{
  row: GanttRow;
  index: number;
  isExpanded: boolean;
  onToggleExpand: (taskId: string) => void;
  onTaskEdit?: (task: any) => void;
}> = ({ row, index, isExpanded, onToggleExpand, onTaskEdit }) => {
  // For reordering within list
  const {
    attributes: sortAttributes,
    listeners: sortListeners,
    setNodeRef: setSortNodeRef,
    transform,
    transition,
    isDragging: isSorting,
  } = useSortable({ id: row.taskId });

  // DISABLED: For dragging to timeline
  // const {
  //   attributes: dragAttributes,
  //   listeners: dragListeners,
  //   setNodeRef: setDragNodeRef,
  //   isDragging: isDraggingToTimeline,
  // } = useDraggable({
  //   id: `task-drag-${row.taskId}`,
  //   data: {
  //     type: "task",
  //     task: row.task,
  //     taskId: row.taskId,
  //   },
  // });
  
  // Placeholder values when drag is disabled
  const dragAttributes = {};
  const dragListeners = {};
  const setDragNodeRef = () => {};
  const isDraggingToTimeline = false;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSorting || isDraggingToTimeline ? 0.5 : 1,
    cursor: isDraggingToTimeline ? "grabbing" : "grab",
  };

  const getPriorityEmoji = (priority: string) => {
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

  const hasSubtasks = row.subtasks && row.subtasks.length > 0;

  return (
      <div
        ref={(node) => {
          setSortNodeRef(node);
          // DISABLED: Sidebar drag-to-timeline feature
          // setDragNodeRef(node);
        }}
      style={style}
      className="task-row border-b border-border h-16 flex items-center px-4 hover:bg-muted/50 transition-colors"
    >
      {/* Reorder handle (for list reordering) */}
      <div
        {...sortAttributes}
        {...sortListeners}
        className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded mr-2"
      >
        <GripVertical className="w-4 h-4 text-muted-foreground" />
      </div>

      {/* DISABLED: Drag to timeline handle (entire row) */}
      <div
        // {...dragAttributes}
        // {...dragListeners}
        className={`flex-1 ${ENABLE_SIDEBAR_DRAG_CREATE ? 'cursor-grab active:cursor-grabbing' : ''}`}
      >

      {/* Expand/collapse button */}
      {hasSubtasks && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 mr-2"
          onClick={() => onToggleExpand(row.taskId)}
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </Button>
      )}
      {!hasSubtasks && <div className="w-8" />}

        {/* Task info - double-clickable to edit */}
        <div 
          className="flex-1 min-w-0 cursor-pointer hover:bg-muted/30 rounded px-2 py-1 -mx-2 -my-1"
          onDoubleClick={(e) => {
            e.stopPropagation();
            onTaskEdit?.(row.task);
          }}
          title="Double-click to edit"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm">{getPriorityEmoji(row.task.priority)}</span>
            <span className="font-medium text-sm truncate">{row.task.title}</span>
            {row.segments.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {row.segments.length} session{row.segments.length > 1 ? "s" : ""}
              </Badge>
            )}
          </div>
          {row.task.deadline && (
            <div className="text-xs text-muted-foreground mt-1">
              Due: {format(parseISO(row.task.deadline), "MMM d")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const UnifiedTaskListPanel: React.FC<UnifiedTaskListPanelProps> = ({
  ganttRows,
  onTaskReorder,
  expandedTaskIds,
  onToggleExpand,
  onTaskEdit,
  onCollapse,
  scrollRef,
  syncScrollRef,
  isScrollingRef,
}) => {
  const internalScrollRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = scrollRef || internalScrollRef;

  // Sync scroll with timeline panel
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
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
  }, [scrollContainerRef, syncScrollRef, isScrollingRef]);
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const sourceIndex = ganttRows.findIndex((r) => r.taskId === active.id);
    const destIndex = ganttRows.findIndex((r) => r.taskId === over.id);

    if (sourceIndex === -1 || destIndex === -1) return;

    // Call the reorder handler (which will update global task order)
    onTaskReorder(sourceIndex, destIndex);
  };

  return (
    <div 
      ref={scrollContainerRef}
      className="unified-task-list-panel h-full bg-card overflow-y-auto"
    >
      {/* Header */}
      <div className="sticky top-0 bg-card border-b px-4 py-3 font-medium text-sm z-10 flex items-center justify-between">
        <span>Tasks ({ganttRows.length})</span>
        {onCollapse && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onCollapse}
            className="h-8 w-8"
            title="Collapse task list"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Task list - perfectly aligned with timeline */}
      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={ganttRows.map((r) => r.taskId)}
          strategy={verticalListSortingStrategy}
        >
          {ganttRows.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No tasks for this day. Create a task to get started.
            </div>
          ) : (
            ganttRows.map((row, index) => (
              <SortableTaskRow
                key={row.taskId}
                row={row}
                index={index}
                isExpanded={expandedTaskIds.has(row.taskId)}
                onToggleExpand={onToggleExpand}
                onTaskEdit={onTaskEdit}
              />
            ))
          )}
        </SortableContext>
      </DndContext>
    </div>
  );
};

