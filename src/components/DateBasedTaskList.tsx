import { useState, useEffect } from "react";
import { useTaskStore } from "@/stores/taskStore";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Check, Edit, Calendar, Clock, Tag, Sparkles, ChevronDown, ChevronRight, GripVertical, ChevronLeft } from "lucide-react";
import { TaskDialog } from "./TaskDialog";
import { AIBreakdownDialog } from "./AIBreakdownDialog";
import { format, addDays, subDays, isToday, isSameDay, parseISO } from "date-fns";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Task } from "@/stores/taskStore";
import { Input } from "@/components/ui/input";

// SubtaskDndContext component to handle subtask drag-and-drop
interface SubtaskDndContextProps {
  subtasks: Task[];
  onDragEnd: (event: DragEndEvent) => void;
  onToggleStatus: (subtask: Task) => void;
  onEdit: (subtask: Task) => void;
  onDelete: (subtaskId: string) => void;
  expandedSubtasks: Set<string>;
  setExpandedSubtasks: (set: Set<string>) => void;
}

const SubtaskDndContext = ({
  subtasks,
  onDragEnd,
  onToggleStatus,
  onEdit,
  onDelete,
  expandedSubtasks,
  setExpandedSubtasks,
}: SubtaskDndContextProps) => {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
    >
      <SortableContext
        items={subtasks.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-2">
          {subtasks
            .sort((a, b) => (a.order || 0) - (b.order || 0))
            .map((subtask) => (
              <SortableSubtask
                key={subtask.id}
                subtask={subtask}
                isExpanded={expandedSubtasks.has(subtask.id)}
                onToggleExpand={() => {
                  const newExpanded = new Set(expandedSubtasks);
                  if (newExpanded.has(subtask.id)) {
                    newExpanded.delete(subtask.id);
                  } else {
                    newExpanded.add(subtask.id);
                  }
                  setExpandedSubtasks(newExpanded);
                }}
                onToggleStatus={onToggleStatus}
                onEdit={onEdit}
                onDelete={onDelete}
                expandedSubtasks={expandedSubtasks}
                setExpandedSubtasks={setExpandedSubtasks}
              />
            ))}
        </div>
      </SortableContext>
    </DndContext>
  );
};

// SortableSubtask component for drag-and-drop subtasks
interface SortableSubtaskProps {
  subtask: Task;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onToggleStatus: (subtask: Task) => void;
  onEdit: (subtask: Task) => void;
  onDelete: (subtaskId: string) => void;
  expandedSubtasks: Set<string>;
  setExpandedSubtasks: (set: Set<string>) => void;
}

const SortableSubtask = ({
  subtask,
  isExpanded,
  onToggleExpand,
  onToggleStatus,
  onEdit,
  onDelete,
  expandedSubtasks,
  setExpandedSubtasks,
}: SortableSubtaskProps) => {
  const { updateTask } = useTaskStore();
  const { toast } = useToast();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: subtask.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 50 : 1,
  };

  const isSubtaskExpanded = expandedSubtasks.has(subtask.id);

  return (
    <div ref={setNodeRef} style={style}>
      <Card 
        className={`p-3 shadow-sm ml-4 border-l-2 border-muted cursor-pointer hover:bg-muted/50 transition-colors ${
          isDragging ? "shadow-lg border-primary/50 bg-primary/5" : ""
        }`}
        onClick={(e) => {
          // Don't toggle if clicking on buttons, input, or drag handle
          if ((e.target as HTMLElement).closest('button, input, [data-drag-handle]')) {
            return;
          }
          const newExpanded = new Set(expandedSubtasks);
          if (newExpanded.has(subtask.id)) {
            newExpanded.delete(subtask.id);
          } else {
            newExpanded.add(subtask.id);
          }
          setExpandedSubtasks(newExpanded);
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2 flex-1">
            <button
              {...attributes}
              {...listeners}
              data-drag-handle
              className="cursor-grab active:cursor-grabbing p-1.5 hover:bg-muted rounded mt-0.5 transition-colors touch-none"
              onClick={(e) => e.stopPropagation()}
              title="Drag to reorder"
            >
              <GripVertical className="w-4 h-4 text-muted-foreground hover:text-foreground" />
            </button>
            <span className="text-muted-foreground mt-1 text-sm">└─</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onToggleStatus(subtask);
              }}
              className={`p-1 h-auto ${
                subtask.status === "completed" ? "text-success" : ""
              }`}
            >
              <div
                className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                  subtask.status === "completed"
                    ? "border-success bg-success"
                    : "border-muted-foreground"
                }`}
              >
                {subtask.status === "completed" && (
                  <Check className="w-3 h-3 text-success-foreground" />
                )}
              </div>
            </Button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {isSubtaskExpanded ? (
                  <ChevronDown className="w-3 h-3 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-3 h-3 text-muted-foreground" />
                )}
                <EditableTitle
                  title={subtask.title}
                  onSave={async (newTitle) => {
                    if (newTitle.trim() && newTitle !== subtask.title) {
                      try {
                        await updateTask(subtask.id, { title: newTitle.trim() });
                        toast({
                          title: "Subtask updated",
                          description: "Title has been updated.",
                        });
                      } catch (error: any) {
                        toast({
                          variant: "destructive",
                          title: "Error",
                          description: "Failed to update subtask title",
                        });
                      }
                    }
                  }}
                  className={`font-medium text-sm ${
                    subtask.status === "completed"
                      ? "line-through text-muted-foreground"
                      : ""
                  }`}
                />
                {subtask.estimated_minutes && (
                  <Badge variant="outline" className="text-xs gap-1">
                    <Clock className="w-3 h-3" />
                    {subtask.estimated_minutes} min
                  </Badge>
                )}
              </div>
              {isSubtaskExpanded && subtask.description && (
                <p className="text-xs text-muted-foreground mt-1 ml-5">
                  {subtask.description}
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="sm" onClick={() => onEdit(subtask)} className="h-8 w-8 p-0">
              <Edit className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(subtask.id)}
              className="text-destructive h-8 w-8 p-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

// EditableTitle component for inline editing
interface EditableTitleProps {
  title: string;
  onSave: (newTitle: string) => void;
  className?: string;
}

const EditableTitle = ({ title, onSave, className }: EditableTitleProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(title);

  useEffect(() => {
    setEditValue(title);
  }, [title]);

  const handleDoubleClick = () => {
    setIsEditing(true);
    setEditValue(title);
  };

  const handleBlur = () => {
    if (editValue.trim() && editValue !== title) {
      onSave(editValue);
    } else {
      setEditValue(title);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleBlur();
    } else if (e.key === "Escape") {
      setEditValue(title);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <Input
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={`h-auto py-0 px-1 text-sm ${className}`}
        autoFocus
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  return (
    <h3
      onDoubleClick={handleDoubleClick}
      className={`cursor-text hover:bg-muted/50 rounded px-1 py-0.5 transition-colors ${className}`}
      title="Double-click to edit"
    >
      {title}
    </h3>
  );
};

interface SortableTaskProps {
  task: Task;
  subtasks: Task[];
  isExpanded: boolean;
  onToggleExpand: (taskId: string) => void;
  onToggleStatus: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onAIBreakdown: (task: Task) => void;
  onAddSubtask: (task: Task) => void;
  getPriorityBadgeClassName: (priority: string) => string;
  getStatusColor: (status: string) => string;
  expandedSubtasks: Set<string>;
  setExpandedSubtasks: (set: Set<string>) => void;
}

const SortableTask = ({
  task,
  subtasks: initialSubtasks,
  isExpanded,
  onToggleExpand,
  onToggleStatus,
  onEdit,
  onDelete,
  onAIBreakdown,
  onAddSubtask,
  getPriorityBadgeClassName,
  getStatusColor,
  expandedSubtasks,
  setExpandedSubtasks,
}: SortableTaskProps) => {
  const { updateTask, getSubtasks } = useTaskStore();
  const { toast } = useToast();
  
  // Get subtasks from store to ensure we always have the latest data
  const subtasks = getSubtasks(task.id).sort((a, b) => (a.order || 0) - (b.order || 0));
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

  return (
    <div ref={setNodeRef} style={style}>
      <Card 
        className={`p-5 shadow-soft hover:shadow-medium transition-all ${
          task.status === "completed" ? "opacity-60" : ""
        } ${isDragging ? "shadow-lg" : ""}`}
        onDoubleClick={() => onEdit(task)}
        title="Double-click to edit"
        style={{ cursor: 'pointer' }}
      >
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 flex-1">
              <div className="flex items-center gap-2">
                <button
                  {...attributes}
                  {...listeners}
                  className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded"
                >
                  <GripVertical className="w-4 h-4 text-muted-foreground" />
                </button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onToggleExpand(task.id)}
                  className="p-1 h-auto"
                  title={isExpanded ? "Collapse" : "Expand"}
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onToggleStatus(task)}
                className={`p-1 h-auto mt-1 ${
                  task.status === "completed" ? "text-success" : ""
                }`}
              >
                <div
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                    task.status === "completed"
                      ? "bg-success border-success"
                      : "border-muted-foreground"
                  }`}
                >
                  {task.status === "completed" && <Check className="w-3 h-3 text-white" />}
                </div>
              </Button>
              <div className="flex-1 space-y-2">
                <div>
                  <h4
                    className={`font-medium text-lg ${
                      task.status === "completed" ? "line-through text-muted-foreground" : ""
                    }`}
                  >
                    {task.title}
                  </h4>
                  {task.description && (
                    <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className={getPriorityBadgeClassName(task.priority)}>{task.priority}</Badge>
                  <Badge className={getStatusColor(task.status)}>{task.status}</Badge>
                  {/* PRD: Show deadline only if different from planned_date */}
                  {task.deadline && task.planned_date && task.deadline !== task.planned_date && (
                    <Badge variant="outline" className="gap-1">
                      <Calendar className="w-3 h-3" />
                      Due: {format(new Date(task.deadline), "MMM d, yyyy")}
                    </Badge>
                  )}
                  {task.deadline && !task.planned_date && (
                    <Badge variant="outline" className="gap-1">
                      <Calendar className="w-3 h-3" />
                      Due: {format(new Date(task.deadline), "MMM d, yyyy")}
                    </Badge>
                  )}
                  {task.estimated_minutes && (
                    <Badge variant="outline" className="gap-1">
                      <Clock className="w-3 h-3" />
                      {task.estimated_minutes} min
                    </Badge>
                  )}
                  {task.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="gap-1">
                      <Tag className="w-3 h-3" />
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onAIBreakdown(task)}
                className="text-primary hover:text-primary"
                title="AI Breakdown"
              >
                <Sparkles className="w-4 h-4 mr-1" />
                <span className="text-xs">AI</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onEdit(task)} title="Edit Task">
                <Edit className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(task.id)}
                className="text-destructive hover:text-destructive"
                title="Delete Task"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {isExpanded && (
        <div className="ml-8 mt-2 space-y-2">
          {subtasks.length > 0 ? (
            <SubtaskDndContext
              subtasks={subtasks.sort((a, b) => (a.order || 0) - (b.order || 0))}
              onDragEnd={async (event) => {
                const { active, over } = event;
                if (over && active.id !== over.id) {
                  // Sort subtasks by current order
                  const sortedSubtasks = [...subtasks].sort((a, b) => (a.order || 0) - (b.order || 0));
                  const oldIndex = sortedSubtasks.findIndex((t) => t.id === active.id);
                  const newIndex = sortedSubtasks.findIndex((t) => t.id === over.id);
                  
                  if (oldIndex !== -1 && newIndex !== -1) {
                    const newOrder = arrayMove(sortedSubtasks, oldIndex, newIndex);

                    // Persist via global store action (single authoritative mutation path)
                    try {
                      const store = useTaskStore.getState();
                      await store.reorderSubtasks(task.id, newOrder.map((t) => t.id));
                      
                      toast({
                        title: "Subtask order updated",
                        description: "Subtask order has been saved.",
                      });
                    } catch (error: any) {
                      console.error('Failed to update subtask order:', error);
                      toast({
                        variant: "destructive",
                        title: "Error",
                        description: "Failed to update subtask order. Changes were reverted.",
                      });
                    }
                  }
                }
              }}
              onToggleStatus={onToggleStatus}
              onEdit={onEdit}
              onDelete={onDelete}
              expandedSubtasks={expandedSubtasks}
              setExpandedSubtasks={setExpandedSubtasks}
            />
          ) : (
            <div className="ml-4 text-sm text-muted-foreground italic">
              No subtasks yet
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAddSubtask(task)}
            className="ml-4 mt-2 text-xs"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Add Subtask
          </Button>
        </div>
      )}
    </div>
  );
};

export const DateBasedTaskList = () => {
  const {
    selectedDate,
    setSelectedDate,
    tasks,
    tasksByDate,
    fetchTasks,
    getTasksForDate,
    getDatesWithTasks,
    getSubtasks,
    updateTask,
    deleteTask: deleteTaskFromStore,
  } = useTaskStore();

  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [parentTaskId, setParentTaskId] = useState<string | null>(null);
  const [aiBreakdownTask, setAiBreakdownTask] = useState<Task | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [expandedSubtasks, setExpandedSubtasks] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    const tasksForDate = getTasksForDate(selectedDate);
    let filtered = tasksForDate.filter((task) => !task.parent_task_id);

    if (statusFilter !== "all") {
      filtered = filtered.filter((task) => task.status === statusFilter);
    }

    if (priorityFilter !== "all") {
      filtered = filtered.filter((task) => task.priority === priorityFilter);
    }

    setFilteredTasks(filtered);
  }, [selectedDate, tasks, statusFilter, priorityFilter, getTasksForDate]);

  const datesWithTasks = getDatesWithTasks();

  const toggleTaskStatus = async (task: Task) => {
    const newStatus = task.status === "completed" ? "todo" : "completed";
    try {
      await updateTask(task.id, { status: newStatus });
      toast({
        title: "Task updated",
        description: `Task marked as ${newStatus}`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update task",
      });
    }
  };

  const handleEdit = (task: Task) => {
    // Get fresh task from global store to ensure we have latest data
    const freshTask = tasks.find(t => t.id === task.id);
    if (freshTask) {
      setEditingTask(freshTask);
    } else {
      setEditingTask(task); // Fallback to passed task if not found in store
    }
    setParentTaskId(null);
    setDialogOpen(true);
  };

  const handleAddSubtask = (parentTask: Task) => {
    setEditingTask(null);
    setParentTaskId(parentTask.id);
    setDialogOpen(true);
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingTask(null);
      setParentTaskId(null);
    }
  };

  const handleAIBreakdown = (task: Task) => {
    setAiBreakdownTask(task);
    setAiDialogOpen(true);
  };

  const handleAIDialogClose = () => {
    setAiDialogOpen(false);
    setAiBreakdownTask(null);
  };

  const toggleExpand = (taskId: string) => {
    const newExpanded = new Set(expandedTasks);
    if (newExpanded.has(taskId)) {
      newExpanded.delete(taskId);
    } else {
      newExpanded.add(taskId);
    }
    setExpandedTasks(newExpanded);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = filteredTasks.findIndex((t) => t.id === active.id);
      const newIndex = filteredTasks.findIndex((t) => t.id === over.id);
      const newOrder = arrayMove(filteredTasks, oldIndex, newIndex);
      setFilteredTasks(newOrder);
    }
  };

  // PRD: Priority colors and icons - 使用设计系统颜色，柔和版本
  const getPriorityConfig = (priority: string) => {
    switch (priority) {
      case "urgent":
        return { color: "hsl(0, 50%, 88%)", icon: "🔴", label: "Urgent" }; // 基于destructive (0, 72%, 60%)，更柔和
      case "high":
        return { color: "hsl(25, 60%, 88%)", icon: "🟡", label: "High Priority" }; // 基于accent (25, 85%, 65%)，更柔和
      case "medium":
        return { color: "hsl(185, 50%, 85%)", icon: "🔵", label: "Medium Priority" }; // 基于primary (185, 80%, 48%)，更柔和
      case "low":
        return { color: "hsl(210, 15%, 88%)", icon: "⚪", label: "Low Priority" }; // 基于muted (210, 20%, 95%)，稍深
      default:
        return { color: "hsl(210, 15%, 88%)", icon: "⚪", label: "Low Priority" };
    }
  };

  const getPriorityColor = (priority: string): "default" | "destructive" | "secondary" => {
    switch (priority) {
      case "urgent":
      case "high":
        return "destructive";
      case "medium":
        return "default";
      case "low":
        return "secondary";
      default:
        return "default";
    }
  };

  // 获取优先级 Badge 的自定义颜色类名（使用设计系统颜色，柔和版本）
  const getPriorityBadgeClassName = (priority: string): string => {
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

  // PRD: Group tasks by priority
  const groupTasksByPriority = (tasks: Task[]) => {
    const groups: { [key: string]: Task[] } = {
      urgent: [],
      high: [],
      medium: [],
      low: [],
    };
    
    tasks.forEach((task) => {
      const priority = task.priority || "low";
      if (groups[priority]) {
        groups[priority].push(task);
      } else {
        groups.low.push(task);
      }
    });
    
    return groups;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-success/20 text-success-foreground";
      case "in_progress":
        return "bg-primary/20 text-primary";
      case "todo":
        return "bg-muted";
      default:
        return "bg-muted";
    }
  };

  const navigateDate = (direction: 'prev' | 'next' | 'today') => {
    if (direction === 'today') {
      setSelectedDate(new Date());
    } else if (direction === 'prev') {
      setSelectedDate(subDays(selectedDate, 1));
    } else {
      setSelectedDate(addDays(selectedDate, 1));
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 shadow-medium">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold">Tasks by Date</h3>
          <div className="flex items-center gap-3">
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Task
            </Button>
          </div>
        </div>

        {/* Date Navigation */}
        <div className="flex items-center gap-4 mb-4">
          <Button variant="outline" size="sm" onClick={() => navigateDate('prev')}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-[280px] justify-start text-left font-normal",
                  !selectedDate && "text-muted-foreground"
                )}
              >
                <Calendar className="mr-2 h-4 w-4" />
                {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <CalendarComponent
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                modifiers={{
                  hasTasks: datesWithTasks.map((d) => new Date(d + 'T00:00:00')),
                }}
                modifiersClassNames={{
                  hasTasks: "relative after:absolute after:bottom-1 after:right-1 after:w-2 after:h-2 after:bg-red-500 after:rounded-full",
                }}
                className="rounded-md border"
              />
            </PopoverContent>
          </Popover>

          <Button variant="outline" size="sm" onClick={() => navigateDate('next')}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          
          <Button variant="outline" size="sm" onClick={() => navigateDate('today')}>
            Today
          </Button>
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="todo">To Do</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>

          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter by priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="urgent">🔴 Urgent</SelectItem>
              <SelectItem value="high">🟡 High</SelectItem>
              <SelectItem value="medium">🔵 Medium</SelectItem>
              <SelectItem value="low">⚪ Low</SelectItem>
            </SelectContent>
          </Select>

          <div className="text-sm text-muted-foreground flex items-center ml-auto">
            Showing {filteredTasks.length} tasks for {format(selectedDate, "MMM d, yyyy")}
          </div>
        </div>
      </Card>

      {/* PRD: Group tasks by priority */}
      {filteredTasks.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">
            No tasks for {format(selectedDate, "MMM d, yyyy")}. Click "Add Task" to create one.
          </p>
        </Card>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <div className="space-y-6">
            {(() => {
              const priorityGroups = groupTasksByPriority(filteredTasks);
              const priorityOrder: Array<'urgent' | 'high' | 'medium' | 'low'> = ['urgent', 'high', 'medium', 'low'];
              
              return priorityOrder.map((priority) => {
                const tasks = priorityGroups[priority];
                if (tasks.length === 0) return null;
                
                const config = getPriorityConfig(priority);
                
                return (
                  <div key={priority} className="space-y-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{config.icon}</span>
                      <h4 className="font-semibold text-base">
                        {config.label} ({tasks.length} {tasks.length === 1 ? 'task' : 'tasks'})
                      </h4>
                    </div>
                    <SortableContext
                      items={tasks.map((t) => t.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-3">
                        {tasks.map((task) => (
                          <SortableTask
                            key={task.id}
                            task={task}
                            subtasks={getSubtasks(task.id)}
                            isExpanded={expandedTasks.has(task.id)}
                            onToggleExpand={toggleExpand}
                            onToggleStatus={toggleTaskStatus}
                            onEdit={handleEdit}
                            onDelete={async (id: string) => {
                              try {
                                await deleteTaskFromStore(id);
                                toast({
                                  title: "Task deleted",
                                  description: "The task has been removed.",
                                });
                              } catch (error: any) {
                                toast({
                                  variant: "destructive",
                                  title: "Error",
                                  description: "Failed to delete task",
                                });
                              }
                            }}
                            onAIBreakdown={handleAIBreakdown}
                            onAddSubtask={handleAddSubtask}
                            getPriorityBadgeClassName={getPriorityBadgeClassName}
                            getStatusColor={getStatusColor}
                            expandedSubtasks={expandedSubtasks}
                            setExpandedSubtasks={setExpandedSubtasks}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </div>
                );
              });
            })()}
          </div>
        </DndContext>
      )}

      <TaskDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        onSuccess={() => {
          // TaskDialog already refreshes taskStore internally
          // Just ensure local state is in sync
          fetchTasks();
        }}
        editTask={editingTask}
        parentTaskId={parentTaskId}
        defaultDeadline={!editingTask ? selectedDate : undefined}
      />

      <AIBreakdownDialog
        open={aiDialogOpen}
        onOpenChange={handleAIDialogClose}
        onSuccess={() => {
          fetchTasks();
          // Auto-expand parent task if subtasks were created
          if (aiBreakdownTask) {
            setExpandedTasks((prev) => new Set([...prev, aiBreakdownTask.id]));
          }
        }}
        parentTask={aiBreakdownTask}
      />
    </div>
  );
};

