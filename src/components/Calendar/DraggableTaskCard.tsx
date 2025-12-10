import React from "react";
// import { useDraggable } from "@dnd-kit/core"; // DISABLED: Sidebar drag-to-calendar feature
import { Task } from "@/stores/taskStore";
import { GripVertical, Calendar, Clock } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

// DISABLED: Sidebar drag-to-calendar feature to prevent page freeze
const ENABLE_SIDEBAR_DRAG_CREATE = false;

interface DraggableTaskCardProps {
  task: Task;
  onDoubleClick?: (task: Task) => void;
  dragHandle?: React.ReactNode;
}

export const DraggableTaskCard: React.FC<DraggableTaskCardProps> = ({ task, onDoubleClick, dragHandle }) => {
  // DISABLED: Sidebar drag-to-calendar feature
  // const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
  //   id: `task-${task.id}`,
  //   data: {
  //     type: "task",
  //     task,
  //   },
  // });
  
  // Placeholder values when drag is disabled
  const attributes = {};
  const listeners = {};
  const setNodeRef = () => {};
  const isDragging = false;

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "destructive";
      case "high":
        return "default"; // Will use custom orange color
      case "medium":
        return "default";
      case "low":
        return "secondary";
      default:
        return "default";
    }
  };

  const getPriorityClassName = (priority: string): string => {
    switch (priority) {
      case "urgent":
        return "bg-[hsl(0,50%,88%)] text-[hsl(0,60%,35%)] border-[hsl(0,50%,85%)] hover:bg-[hsl(0,50%,90%)]";
      case "high":
        return "bg-[hsl(25,60%,88%)] text-[hsl(25,70%,40%)] border-[hsl(25,60%,85%)] hover:bg-[hsl(25,60%,90%)]";
      case "medium":
        return "bg-[hsl(185,50%,85%)] text-[hsl(185,80%,35%)] border-[hsl(185,50%,82%)] hover:bg-[hsl(185,50%,87%)]";
      case "low":
        return "bg-[hsl(210,15%,88%)] text-[hsl(210,20%,45%)] border-[hsl(210,15%,85%)] hover:bg-[hsl(210,15%,90%)]";
      default:
        return "";
    }
  };

  // Make it draggable for both dnd-kit and FullCalendar
  // Default duration: 1 hour (fixed)
  const eventData = {
    title: task.title,
    duration: { minutes: 60 }, // Fixed 1 hour default
  };

  return (
    <Card
      ref={(node) => {
        setNodeRef(node);
        // DISABLED: Sidebar drag-to-calendar feature
        // if (ENABLE_SIDEBAR_DRAG_CREATE && node) {
        //   // Also set data-event for FullCalendar
        //   node.setAttribute('data-event', JSON.stringify(eventData));
        //   node.setAttribute('data-task-id', task.id);
        //   // Make it draggable for FullCalendar
        //   node.setAttribute('draggable', 'true');
        //   node.classList.add('fc-event');
        // }
      }}
      className={`
        task-card p-3 bg-card hover:shadow-md transition-all
        ${ENABLE_SIDEBAR_DRAG_CREATE ? 'cursor-move' : 'cursor-pointer'}
        ${isDragging ? "opacity-50 shadow-lg" : "opacity-100"}
      `}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onDoubleClick?.(task);
      }}
      title="Double-click to edit"
      // DISABLED: Sidebar drag-to-calendar feature
      // {...listeners}
      // {...attributes}
      // style={{ ...attributes.style, touchAction: 'none' }}
    >
      <div className="flex items-start gap-2">
        {/* dragHandle is now provided by SidebarTaskList, so we don't show it here */}

        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">{task.title}</div>

          {task.description && (
            <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {task.description}
            </div>
          )}

          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {task.deadline && (
              <Badge variant="outline" className="text-xs gap-1">
                <Calendar className="w-3 h-3" />
                {format(parseISO(task.deadline), "MMM d")}
              </Badge>
            )}

            {task.estimated_minutes && (
              <Badge variant="outline" className="text-xs gap-1">
                <Clock className="w-3 h-3" />
                {task.estimated_minutes}m
              </Badge>
            )}

            <Badge 
              variant="outline"
              className={`text-xs ${getPriorityClassName(task.priority)}`}
            >
              {task.priority}
            </Badge>
          </div>
        </div>
      </div>
    </Card>
  );
};

