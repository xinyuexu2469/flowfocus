import React from "react";
import { DndContext, closestCenter, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Task } from "@/stores/taskStore";
import { GripVertical } from "lucide-react";

interface SidebarTaskListProps {
  tasks: Task[];
  onReorder: (orderedTaskIds: string[]) => void;
  renderTask: (task: Task) => React.ReactNode;
  emptyMessage?: string;
}

// Sortable task item wrapper
const SortableTaskItem: React.FC<{
  task: Task;
  children: React.ReactNode;
}> = ({ task, children }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const dragHandle = (
    <div
      {...attributes}
      {...listeners}
      className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded mr-2 flex-shrink-0"
    >
      <GripVertical className="w-4 h-4 text-muted-foreground" />
    </div>
  );

  return (
    <div ref={setNodeRef} style={style} className="task-item-wrapper flex items-start w-full">
      {dragHandle}
      <div className="flex-1 min-w-0 w-full">{children}</div>
    </div>
  );
};

/**
 * Shared sidebar task list component with drag-and-drop reordering
 * Used by Calendar, Daily Gantt, and Monthly Gantt sidebars
 */
export const SidebarTaskList: React.FC<SidebarTaskListProps> = ({
  tasks,
  onReorder,
  renderTask,
  emptyMessage = "No tasks to display",
}) => {
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const sourceIndex = tasks.findIndex((t) => t.id === active.id);
    const destIndex = tasks.findIndex((t) => t.id === over.id);

    if (sourceIndex === -1 || destIndex === -1) return;

    // Reorder the task IDs array
    const reordered = Array.from(tasks);
    const [removed] = reordered.splice(sourceIndex, 1);
    reordered.splice(destIndex, 0, removed);

    // Extract task IDs in new order
    const taskIds = reordered.map((t) => t.id);

    // Call the reorder handler
    onReorder(taskIds);
  };

  if (tasks.length === 0) {
    return (
      <div className="text-center text-sm text-muted-foreground py-8">
        {emptyMessage}
      </div>
    );
  }

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={tasks.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        {tasks.map((task) => (
          <SortableTaskItem key={task.id} task={task}>
            {renderTask(task)}
          </SortableTaskItem>
        ))}
      </SortableContext>
    </DndContext>
  );
};

