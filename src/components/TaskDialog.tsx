import { useState, useEffect, useCallback, useMemo } from "react";
import { goalsApi, tasksApi } from "@/lib/api";
import { getApiClient } from "@/lib/clerk-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { X, AlertCircle, Plus, Trash2, Clock } from "lucide-react";
import { format, parseISO, addHours, startOfHour } from "date-fns";
import { useDailyGanttStore } from "@/stores/dailyGanttStore";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { TimeSegment } from "@/types/timeSegment";

interface Goal {
  id: string;
  title: string;
  tier: string;
}

interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  editTask?: any;
  parentTaskId?: string | null;
  defaultDeadline?: Date;
}

export const TaskDialog = ({ open, onOpenChange, onSuccess, editTask, parentTaskId, defaultDeadline }: TaskDialogProps) => {
  const { toast } = useToast();
  const { calculateScheduledTime, createSegment, updateSegment, deleteSegment } = useDailyGanttStore();
  const [loading, setLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [tagInput, setTagInput] = useState("");
  
  // Check if this is a subtask
  // Only show simplified modal when CREATING a new subtask (parentTaskId provided AND no editTask)
  // When EDITING an existing task (even if it's a subtask), always show full modal
  // This ensures all views (Tasks, Kanban, Calendar, Daily Gantt) show the full modal when editing
  const isSubtask = parentTaskId !== null && parentTaskId !== undefined && !editTask;

  // PRD: Add all required fields
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    priority: "medium" as "urgent" | "high" | "medium" | "low",
    priority_color: "" as string | null,
    status: "todo" as "todo" | "in_progress" | "completed",
    planned_date: "", // PRD: The "box" date (required)
    deadline: "", // PRD: Actual due date (optional)
    estimatedMinutes: "",
    estimatedTimeUnit: "minutes" as "hours" | "minutes", // Unit for estimated time
    plannedStart: "",
    plannedEnd: "",
    goalId: "",
    tags: [] as string[],
    time_segments: [] as Array<Partial<TimeSegment>>, // Changed from work_time_blocks to time_segments
  });

  // Load time segments for a task - get ALL segments (from Task Edit, Daily Gantt, Calendar)
  const loadTimeSegments = useCallback(async (taskId: string): Promise<TimeSegment[]> => {
    try {
      const api = getApiClient();
      const allSegments = await api.timeSegments.getAll() as TimeSegment[];
      // Filter by task_id and only include non-deleted segments
      // Include ALL segments regardless of source (task, app, etc.) for unified view
      const taskSegments = allSegments.filter((seg) => 
        seg.task_id === taskId && !seg.deleted_at
      );
      // Sort by start_time
      return taskSegments.sort((a, b) => 
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      );
    } catch (error: any) {
      console.error('Error loading time segments:', error);
      // Return empty array if API fails - don't crash the component
      return [];
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchGoals();
      if (editTask && editTask.id) {
        // Load time segments for this task
        loadTimeSegments(editTask.id).then((segments) => {
          setFormData({
            title: editTask.title || "",
            description: editTask.description || "",
            priority: editTask.priority || "medium",
            priority_color: editTask.priority_color || null,
            status: editTask.status || "todo",
            planned_date: editTask.planned_date ? format(new Date(editTask.planned_date), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"), // Default to today if not set
            deadline: editTask.deadline ? format(new Date(editTask.deadline), "yyyy-MM-dd") : "",
            estimatedMinutes: editTask.estimated_minutes?.toString() || "",
            estimatedTimeUnit: "minutes", // Default to minutes
            plannedStart: editTask.planned_start ? editTask.planned_start.slice(0, 16) : "",
            plannedEnd: editTask.planned_end ? editTask.planned_end.slice(0, 16) : "",
            goalId: editTask.goal_id || "",
            tags: editTask.tags || [],
            time_segments: segments.map((seg) => {
              // Extract date from start_time (always available in ISO format)
              // Format: "yyyy-MM-dd" for HTML date input
              let dateStr: string;
              if (seg.date) {
                // Use date field if available
                dateStr = seg.date.includes('T') ? seg.date.split('T')[0] : seg.date;
              } else if (seg.start_time) {
                // Extract date from ISO datetime string
                dateStr = seg.start_time.split('T')[0];
              } else {
                // Fallback to today
                dateStr = format(new Date(), "yyyy-MM-dd");
              }
              
              return {
                id: seg.id,
                date: dateStr, // Always a string in "yyyy-MM-dd" format
                start_time: seg.start_time, // Full ISO datetime string
                end_time: seg.end_time, // Full ISO datetime string
              };
            }),
          });
        }).catch((error) => {
          console.error('Error loading time segments:', error);
          // Set form data without segments if loading fails
          setFormData({
            title: editTask.title || "",
            description: editTask.description || "",
            priority: editTask.priority || "medium",
            priority_color: editTask.priority_color || null,
            status: editTask.status || "todo",
            planned_date: editTask.planned_date ? format(new Date(editTask.planned_date), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
            deadline: editTask.deadline ? format(new Date(editTask.deadline), "yyyy-MM-dd") : "",
            estimatedMinutes: editTask.estimated_minutes?.toString() || "",
            estimatedTimeUnit: "minutes",
            plannedStart: editTask.planned_start ? editTask.planned_start.slice(0, 16) : "",
            plannedEnd: editTask.planned_end ? editTask.planned_end.slice(0, 16) : "",
            goalId: editTask.goal_id || "",
            tags: editTask.tags || [],
            time_segments: [],
          });
        });
      } else {
        resetForm();
        // If defaultDeadline is provided, use it; otherwise use today (already set in resetForm)
        if (defaultDeadline) {
          setFormData((prev) => ({
            ...prev,
            planned_date: format(defaultDeadline, "yyyy-MM-dd"), // Use selected date from calendar
            deadline: format(defaultDeadline, "yyyy-MM-dd"), // Also set deadline as default
          }));
        }
      }
    }
  }, [open, editTask, loadTimeSegments]);

  const fetchGoals = async () => {
    try {
      const data = await goalsApi.getAll() as Goal[];
      setGoals(data);
    } catch (error: any) {
      // Silently fail - user might not be logged in yet or API might not be available
      console.log('Goals API not available:', error.message);
      setGoals([]);
    }
  };

  const resetForm = () => {
    // Default planned_date to today
    const today = format(new Date(), "yyyy-MM-dd");
    setFormData({
      title: "",
      description: "",
      priority: "medium",
      priority_color: null,
      status: "todo",
      planned_date: today, // Default to today
      deadline: "",
      estimatedMinutes: "",
      estimatedTimeUnit: "minutes",
      plannedStart: "",
      plannedEnd: "",
      goalId: "",
      tags: [],
      time_segments: [],
    });
    setTagInput("");
  };

  const addTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData({ ...formData, tags: [...formData.tags, tagInput.trim()] });
      setTagInput("");
    }
  };

  const removeTag = (tag: string) => {
    setFormData({ ...formData, tags: formData.tags.filter((t) => t !== tag) });
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      toast({ variant: "destructive", title: "Error", description: "Title is required" });
      return;
    }
    
    // Ensure planned_date is set (default to today if not set)
    const plannedDate = formData.planned_date || format(new Date(), "yyyy-MM-dd");

    setLoading(true);

    try {
      // Get API client (may throw if Clerk not initialized)
      let api;
      try {
        api = getApiClient();
      } catch (apiError: any) {
        // If getApiClient fails, we can still save the task but not the time segments
        console.warn('getApiClient failed, saving task without time segments:', apiError);
        // For subtasks, only save title, description, and estimated_minutes
        // Calculate order for new subtasks
        let subtaskOrder = 0;
        if (isSubtask && !editTask) {
          const parentId = parentTaskId || editTask?.parent_task_id;
          if (parentId) {
            try {
              const allTasks = await tasksApi.getAll() as any[];
              const existingSubtasks = allTasks.filter(t => t.parent_task_id === parentId);
              if (existingSubtasks.length > 0) {
                subtaskOrder = Math.max(...existingSubtasks.map(t => t.order || 0)) + 1;
              }
            } catch (error) {
              console.error("Failed to get existing subtasks for order calculation:", error);
            }
          }
        }
        
        const taskData = isSubtask
          ? {
              title: formData.title,
              description: formData.description || null,
              estimated_minutes: formData.estimatedMinutes 
                ? formData.estimatedTimeUnit === "hours" 
                  ? parseInt(formData.estimatedMinutes) * 60 
                  : parseInt(formData.estimatedMinutes)
                : null,
              parent_task_id: parentTaskId || (editTask?.parent_task_id || null),
              order: editTask ? editTask.order : subtaskOrder,
            }
          : {
              title: formData.title,
              description: formData.description || null,
              priority: formData.priority,
              priority_color: formData.priority_color || null,
              status: formData.status,
              planned_date: plannedDate,
              deadline: formData.deadline || null,
              estimated_minutes: formData.estimatedMinutes 
                ? formData.estimatedTimeUnit === "hours" 
                  ? parseInt(formData.estimatedMinutes) * 60 
                  : parseInt(formData.estimatedMinutes)
                : null,
              planned_start: formData.plannedStart ? new Date(formData.plannedStart).toISOString() : null,
              planned_end: formData.plannedEnd ? new Date(formData.plannedEnd).toISOString() : null,
              goal_id: formData.goalId || null,
              tags: formData.tags,
              // Preserve parent_task_id if editing an existing subtask, otherwise set to null for main tasks
              parent_task_id: editTask?.parent_task_id || null,
            };

        if (editTask && editTask.id) {
          await tasksApi.update(editTask.id, taskData);
        } else {
          await tasksApi.create(taskData);
        }

        toast({
          title: "Success",
          description: editTask ? "Task updated successfully (time segments not saved)" : "Task created successfully (time segments not saved)",
        });
        onSuccess();
        onOpenChange(false);
        resetForm();
        setLoading(false);
        return;
      }
      
      // First, create or update the task
      // For subtasks, only save title, description, and estimated_minutes
      // Calculate order for new subtasks
      let subtaskOrder = 0;
      if (isSubtask && !editTask) {
        const parentId = parentTaskId || editTask?.parent_task_id;
        if (parentId) {
          try {
            const allTasks = await tasksApi.getAll() as any[];
            const existingSubtasks = allTasks.filter(t => t.parent_task_id === parentId);
            if (existingSubtasks.length > 0) {
              subtaskOrder = Math.max(...existingSubtasks.map(t => t.order || 0)) + 1;
            }
          } catch (error) {
            console.error("Failed to get existing subtasks for order calculation:", error);
          }
        }
      }
      
      const taskData = isSubtask
        ? {
            title: formData.title,
            description: formData.description || null,
            estimated_minutes: formData.estimatedMinutes 
              ? formData.estimatedTimeUnit === "hours" 
                ? parseInt(formData.estimatedMinutes) * 60 
                : parseInt(formData.estimatedMinutes)
              : null,
            parent_task_id: parentTaskId || (editTask?.parent_task_id || null),
            order: editTask ? editTask.order : subtaskOrder,
          }
        : {
            title: formData.title,
            description: formData.description || null,
            priority: formData.priority,
            priority_color: formData.priority_color || null,
            status: formData.status,
            planned_date: plannedDate, // PRD: The "box" date (defaults to today)
            deadline: formData.deadline || null, // PRD: Actual due date (optional)
            estimated_minutes: formData.estimatedMinutes 
              ? formData.estimatedTimeUnit === "hours" 
                ? parseInt(formData.estimatedMinutes) * 60 
                : parseInt(formData.estimatedMinutes)
              : null,
            planned_start: formData.plannedStart ? new Date(formData.plannedStart).toISOString() : null,
            planned_end: formData.plannedEnd ? new Date(formData.plannedEnd).toISOString() : null,
            goal_id: formData.goalId || null,
            tags: formData.tags,
            // Preserve parent_task_id if editing an existing subtask, otherwise set to null for main tasks
            parent_task_id: editTask?.parent_task_id || null,
          };

      let taskId: string;
      let existingSegments: TimeSegment[] = [];
      let existingIds = new Set<string>(); // Initialize empty set, will be populated if editing
      
      if (editTask && editTask.id) {
        taskId = editTask.id;
        
        // Get existing segments to compare (before updating)
        existingSegments = await loadTimeSegments(taskId);
        existingIds = new Set(existingSegments.map(s => s.id));
        const formIds = new Set(formData.time_segments.filter(s => s.id).map(s => s.id!));
        
        // Update task first
        await tasksApi.update(taskId, {
          ...taskData,
          scheduled_time: scheduledTime, // Update scheduled_time based on current blocks
        });
        
        // Delete segments that are no longer in the form
        // Only delete segments that were created from Task Edit (source='task')
        // Keep segments created from Daily Gantt/Calendar (source='app') if they're not in the form
        for (const seg of existingSegments) {
          if (seg.source === 'task' && !formIds.has(seg.id)) {
            try {
              await deleteSegment(seg.id);
            } catch (error) {
              console.warn('Error deleting segment:', seg.id, error);
            }
          }
        }
      } else {
        const newTask = await tasksApi.create({
          ...taskData,
          scheduled_time: scheduledTime, // Set scheduled_time for new task
        });
        taskId = newTask.id;
      }

      // Create or update time segments (only for main tasks, not subtasks)
      if (!isSubtask) {
        try {
          for (let i = 0; i < formData.time_segments.length; i++) {
            const segment = formData.time_segments[i];
            
            // Validate: require at least start_time and end_time
            if (!segment.start_time || !segment.end_time) {
              console.warn(`Skipping segment ${i}: missing start_time or end_time`, segment);
              continue;
            }
            
            // Ensure ISO format for start_time - must include full date+time
            let startDateTime: string;
            if (segment.start_time.includes('T')) {
              // Already in ISO format
              startDateTime = segment.start_time;
            } else if (segment.date) {
              // Has date, combine with time
              startDateTime = `${segment.date}T${segment.start_time}:00`;
            } else {
              // No date, extract from start_time if it's ISO, otherwise use today
              console.warn(`Segment ${i} missing date, using today's date`);
              const today = format(new Date(), "yyyy-MM-dd");
              startDateTime = `${today}T${segment.start_time}:00`;
            }
            
            // Ensure ISO format for end_time - must include full date+time
            let endDateTime: string;
            if (segment.end_time.includes('T')) {
              // Already in ISO format
              endDateTime = segment.end_time;
            } else if (segment.date) {
              // Has date, combine with time
              endDateTime = `${segment.date}T${segment.end_time}:00`;
            } else {
              // No date, use the same date as start_time
              const dateFromStart = startDateTime.split('T')[0];
              endDateTime = `${dateFromStart}T${segment.end_time}:00`;
            }
            
            // Extract date from start_time (always available now)
            const segmentDate = segment.date || startDateTime.split('T')[0];
            
            // Validate: end_time must be after start_time
            const start = parseISO(startDateTime);
            const end = parseISO(endDateTime);
            
            if (end <= start) {
              console.warn(`Segment ${i}: end_time (${endDateTime}) is not after start_time (${startDateTime}), adjusting`);
              // Auto-fix: set end_time to 1 hour after start_time
              const fixedEnd = addHours(start, 1);
              endDateTime = fixedEnd.toISOString();
            }
            
            // Calculate duration (in minutes)
            let duration = Math.round((parseISO(endDateTime).getTime() - start.getTime()) / 60000);
            
            // Validate: minimum duration of 15 minutes
            if (duration < 15) {
              console.warn(`Segment ${i}: duration (${duration} min) is less than 15 minutes, adjusting`);
              const fixedEnd = addHours(start, 1);
              endDateTime = fixedEnd.toISOString();
              duration = 60; // Set to 1 hour minimum
            }
              
            if (segment.id && existingIds.has(segment.id)) {
              // Update existing segment (preserve source if it was 'app', otherwise use 'task')
              const existingSeg = existingSegments.find(s => s.id === segment.id);
              await updateSegment(segment.id, {
                date: segmentDate,
                start_time: startDateTime,
                end_time: endDateTime,
                duration: duration,
                title: formData.title,
                title_is_custom: false,
                // Preserve source if it was created from Daily Gantt/Calendar
                source: existingSeg?.source === 'app' ? 'app' : 'task',
              });
            } else {
              // Create new segment from Task Edit
              await createSegment({
                task_id: taskId,
                date: segmentDate,
                start_time: startDateTime,
                end_time: endDateTime,
                duration: duration,
                title: formData.title,
                title_is_custom: false,
                status: 'planned',
                source: 'task',
                order: i + 1,
              });
            }
          }
        } catch (error) {
          console.error('Error saving time segments:', error);
          toast({
            variant: "destructive",
            title: "Warning",
            description: "Task saved but some time segments could not be saved",
          });
        }
      }

      // Refresh segments in dailyGanttStore for all affected dates
      try {
        const datesToRefresh = new Set<string>();
        datesToRefresh.add(plannedDate);
        
        // Add all dates from Work Time Blocks
        formData.time_segments.forEach((seg) => {
          if (seg.date) {
            datesToRefresh.add(seg.date);
          } else if (seg.start_time) {
            const date = seg.start_time.split('T')[0];
            datesToRefresh.add(date);
          }
        });
        
        // Refresh segments for all affected dates
        for (const dateStr of datesToRefresh) {
          await useDailyGanttStore.getState().fetchSegmentsForDate(new Date(dateStr));
        }
      } catch (error) {
        console.warn('Error refreshing daily gantt segments:', error);
        // Continue anyway
      }

      // Refresh Calendar store to show updated events
      try {
        const { useCalendarStore } = await import('@/stores/calendarStore');
        // Calculate date range: from earliest segment date to latest, with buffer
        const allDates = Array.from(new Set([
          plannedDate,
          ...formData.time_segments
            .map(seg => seg.date || (seg.start_time ? seg.start_time.split('T')[0] : null))
            .filter(Boolean) as string[]
        ]));
        
        if (allDates.length > 0) {
          const sortedDates = allDates.sort();
          const startDate = new Date(sortedDates[0]);
          const endDate = new Date(sortedDates[sortedDates.length - 1]);
          
          // Add buffer: 1 month before and after
          startDate.setMonth(startDate.getMonth() - 1);
          endDate.setMonth(endDate.getMonth() + 1);
          
          await useCalendarStore.getState().fetchEvents(startDate, endDate);
        }
      } catch (error) {
        console.warn('Error refreshing calendar events:', error);
        // Continue anyway
      }

      // Refresh taskStore to update box membership based on Work Time Blocks
      try {
        const { useTaskStore } = await import('@/stores/taskStore');
        await useTaskStore.getState().refreshSegments();
        await useTaskStore.getState().fetchTasks();
      } catch (error) {
        console.warn('Error refreshing task store:', error);
        // Continue anyway
      }

      // Wait a brief moment to ensure all async operations complete
      await new Promise(resolve => setTimeout(resolve, 100));

      toast({
        title: "Success",
        description: editTask ? "Task updated successfully" : "Task created successfully",
      });
      
      // Call onSuccess callback (allows views to refresh their specific data)
      onSuccess();
      
      // Close modal and reset form
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      console.error('Error in handleSubmit:', error);
      toast({ variant: "destructive", title: "Error", description: error.message || "Failed to save task" });
    }

    setLoading(false);
  };

  const handleDelete = async () => {
    if (!editTask?.id || isDeleting) return;
    const confirmed = window.confirm("确定要删除这个任务吗？相关时间块也会一并移除。");
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      // 记录相关日期，方便删除后刷新各视图
      const datesToRefresh = new Set<string>();
      if (editTask.planned_date) {
        datesToRefresh.add(format(new Date(editTask.planned_date), "yyyy-MM-dd"));
      }
      const segmentsBeforeDelete = await loadTimeSegments(editTask.id);
      segmentsBeforeDelete.forEach((seg) => {
        const dateStr = seg.start_time ? seg.start_time.split("T")[0] : seg.date;
        if (dateStr) datesToRefresh.add(dateStr);
      });

      await tasksApi.delete(editTask.id);
      toast({ title: "已删除", description: "任务及其时间安排已移除。" });

      // 刷新 Daily Gantt（逐日期）
      try {
        for (const dateStr of datesToRefresh) {
          await useDailyGanttStore.getState().fetchSegmentsForDate(new Date(dateStr));
        }
      } catch (error) {
        console.warn("Error refreshing daily gantt after delete:", error);
      }

      // 刷新 Calendar 事件（根据涉及的日期区间）
      try {
        if (datesToRefresh.size > 0) {
          const sorted = Array.from(datesToRefresh).sort();
          const startDate = new Date(sorted[0]);
          const endDate = new Date(sorted[sorted.length - 1]);
          startDate.setMonth(startDate.getMonth() - 1);
          endDate.setMonth(endDate.getMonth() + 1);
          const { useCalendarStore } = await import("@/stores/calendarStore");
          await useCalendarStore.getState().fetchEvents(startDate, endDate);
        }
      } catch (error) {
        console.warn("Error refreshing calendar after delete:", error);
      }

      // 刷新任务列表与时间块缓存
      try {
        const { useTaskStore } = await import("@/stores/taskStore");
        await useTaskStore.getState().refreshSegments();
        await useTaskStore.getState().fetchTasks();
      } catch (error) {
        console.warn("Error refreshing task store after delete:", error);
      }

      onSuccess(); // 让各调用方做自己的刷新
      onOpenChange(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "删除失败",
        description: error.message || "请稍后再试。",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Helper: Get the nearest whole hour from now
  // If current time is later than 23:00 (11pm), default to 00:00–01:00 on the next day
  // Otherwise, use the nearest full hour (round to nearest hour)
  const getNextWholeHour = (): { date: string; startTime: string; endTime: string } => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinutes = now.getMinutes();
    
    // If current time is later than 23:00 (11pm), use 00:00-01:00 on next day
    if (currentHour >= 23) {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      
      return {
        date: format(tomorrow, "yyyy-MM-dd"),
        startTime: "00:00",
        endTime: "01:00",
      };
    }
    
    // Otherwise, get the nearest whole hour (round to nearest hour)
    // If minutes >= 30, round up to next hour; otherwise round down to current hour
    let targetHour = new Date(now);
    if (currentMinutes >= 30) {
      // Round up to next hour
      targetHour.setHours(currentHour + 1, 0, 0, 0);
    } else {
      // Round down to current hour
      targetHour.setHours(currentHour, 0, 0, 0);
    }
    
    const endHour = new Date(targetHour);
    endHour.setHours(endHour.getHours() + 1);
    
    return {
      date: format(targetHour, "yyyy-MM-dd"),
      startTime: format(targetHour, "HH:mm"),
      endTime: format(endHour, "HH:mm"),
    };
  };

  // PRD: Work time blocks management (now using time_segments)
  // Always use today's date (or tomorrow if after 11pm) - not planned_date
  const addWorkTimeBlock = () => {
    const { date, startTime, endTime } = getNextWholeHour();
    
    // Always use the calculated date (today or tomorrow if after 11pm)
    // Ensure full ISO datetime strings with date and time
    const startDateTime = `${date}T${startTime}:00`;
    const endDateTime = `${date}T${endTime}:00`;
    
    setFormData({
      ...formData,
      time_segments: [
        ...formData.time_segments,
        { 
          date: date, // Always set date explicitly
          start_time: startDateTime, // Full ISO datetime string
          end_time: endDateTime, // Full ISO datetime string
        },
      ],
    });
  };

  const removeWorkTimeBlock = (index: number) => {
    setFormData({
      ...formData,
      time_segments: formData.time_segments.filter((_, i) => i !== index),
    });
  };

  const updateWorkTimeBlock = (index: number, field: string, value: string) => {
    const updated = [...formData.time_segments];
    const segment = updated[index];
    
    // Helper: Extract date from segment (from date field or start_time)
    const getCurrentDate = (seg: typeof segment): string => {
      if (seg.date && seg.date.trim() !== '') {
        return seg.date.includes('T') ? seg.date.split('T')[0] : seg.date;
      } else if (seg.start_time) {
        return seg.start_time.split('T')[0];
      } else {
        return format(new Date(), "yyyy-MM-dd");
      }
    };
    
    // Helper: Extract time from ISO datetime string
    const getTimeFromISO = (isoString: string | undefined, fallback: string): string => {
      if (!isoString) return fallback;
      try {
        return format(parseISO(isoString), "HH:mm");
      } catch {
        return fallback;
      }
    };
    
    const currentDate = getCurrentDate(segment);
    
    if (field === 'date') {
      // Update date and rebuild ISO datetime strings, preserving times
      const startTime = getTimeFromISO(segment.start_time, "09:00");
      const endTime = getTimeFromISO(segment.end_time, "10:00");
      
      // Ensure end time is after start time
      const startMinutes = parseInt(startTime.split(':')[0]) * 60 + parseInt(startTime.split(':')[1]);
      const endMinutes = parseInt(endTime.split(':')[0]) * 60 + parseInt(endTime.split(':')[1]);
      const finalEndTime = endMinutes > startMinutes 
        ? endTime 
        : format(addHours(parseISO(`${value}T${startTime}:00`), 1), "HH:mm");
      
      updated[index] = {
        ...segment,
        date: value, // Always update date field explicitly
        start_time: `${value}T${startTime}:00`, // Rebuild ISO datetime
        end_time: `${value}T${finalEndTime}:00`, // Rebuild ISO datetime
      };
    } else if (field === 'start_time') {
      // Update start time, ensure end time is after start time
      const currentEndTime = getTimeFromISO(segment.end_time, "10:00");
      
      const startMinutes = parseInt(value.split(':')[0]) * 60 + parseInt(value.split(':')[1]);
      const endMinutes = parseInt(currentEndTime.split(':')[0]) * 60 + parseInt(currentEndTime.split(':')[1]);
      const finalEndTime = endMinutes > startMinutes 
        ? currentEndTime 
        : format(addHours(parseISO(`${currentDate}T${value}:00`), 1), "HH:mm");
      
      updated[index] = {
        ...segment,
        date: currentDate, // Always ensure date is set
        start_time: `${currentDate}T${value}:00`, // Rebuild ISO datetime
        end_time: `${currentDate}T${finalEndTime}:00`, // Update end time if needed
      };
    } else if (field === 'end_time') {
      // Update end time, ensure it's after start time
      const currentStartTime = getTimeFromISO(segment.start_time, "09:00");
      
      const startMinutes = parseInt(currentStartTime.split(':')[0]) * 60 + parseInt(currentStartTime.split(':')[1]);
      const endMinutes = parseInt(value.split(':')[0]) * 60 + parseInt(value.split(':')[1]);
      const finalEndTime = endMinutes > startMinutes 
        ? value 
        : format(addHours(parseISO(`${currentDate}T${currentStartTime}:00`), 1), "HH:mm");
      
      updated[index] = {
        ...segment,
        date: currentDate, // Always ensure date is set
        start_time: `${currentDate}T${currentStartTime}:00`, // Rebuild ISO datetime
        end_time: `${currentDate}T${finalEndTime}:00`, // Rebuild ISO datetime
      };
    }
    
    setFormData({ ...formData, time_segments: updated });
  };

  // Calculate scheduled time from time_segments (in minutes) - reactive
  const scheduledTime = useMemo(() => {
    return formData.time_segments.reduce((total, seg) => {
      if (seg.start_time && seg.end_time) {
        try {
          const start = parseISO(seg.start_time);
          const end = parseISO(seg.end_time);
          const duration = Math.round((end.getTime() - start.getTime()) / 60000);
          return total + (duration > 0 ? duration : 0);
        } catch (error) {
          console.warn('Error calculating duration for segment:', seg, error);
          return total;
        }
      }
      return total;
    }, 0);
  }, [formData.time_segments]);

  // Get estimated time in minutes
  const getEstimatedTimeInMinutes = (): number | null => {
    if (!formData.estimatedMinutes) return null;
    const value = parseFloat(formData.estimatedMinutes);
    if (isNaN(value)) return null;
    return formData.estimatedTimeUnit === "hours" ? value * 60 : value;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{(editTask && editTask.id) ? "Edit Task" : (parentTaskId ? "Create Subtask" : "Create New Task")}</DialogTitle>
          <DialogDescription>
            {(editTask && editTask.id) ? "Update task details below" : (parentTaskId ? "Fill in the details for your new subtask" : "Fill in the details for your new task")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="What needs to be done?"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Add more details..."
              rows={3}
            />
          </div>

          {/* PRD: Estimated Time */}
          <div className="space-y-2">
            <Label htmlFor="estimated">Estimated Time</Label>
            <div className="flex gap-2">
              <Input
                id="estimated"
                type="number"
                value={formData.estimatedMinutes}
                onChange={(e) => setFormData({ ...formData, estimatedMinutes: e.target.value })}
                placeholder="60"
                className="flex-1"
              />
              <Select
                value={formData.estimatedTimeUnit}
                onValueChange={(value: "hours" | "minutes") => 
                  setFormData({ ...formData, estimatedTimeUnit: value })
                }
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="minutes">Minutes</SelectItem>
                  <SelectItem value="hours">Hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              Your manual estimate of how long this task will take
            </p>
          </div>

          {/* Only show these fields for main tasks, not subtasks */}
          {!isSubtask && (
            <>
              {/* PRD: Priority (4 levels) */}
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={formData.priority === "urgent" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFormData({ ...formData, priority: "urgent", priority_color: "#EF4444" })}
                    className={formData.priority === "urgent" ? "bg-red-500 hover:bg-red-600" : ""}
                  >
                    🔴 Urgent
                  </Button>
                  <Button
                    type="button"
                    variant={formData.priority === "high" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFormData({ ...formData, priority: "high", priority_color: "#F59E0B" })}
                    className={formData.priority === "high" ? "bg-orange-500 hover:bg-orange-600" : ""}
                  >
                    🟡 High
                  </Button>
                  <Button
                    type="button"
                    variant={formData.priority === "medium" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFormData({ ...formData, priority: "medium", priority_color: "#3B82F6" })}
                    className={formData.priority === "medium" ? "bg-blue-500 hover:bg-blue-600" : ""}
                  >
                    🔵 Medium
                  </Button>
                  <Button
                    type="button"
                    variant={formData.priority === "low" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFormData({ ...formData, priority: "low", priority_color: "#9CA3AF" })}
                    className={formData.priority === "low" ? "bg-gray-500 hover:bg-gray-600" : ""}
                  >
                    ⚪ Low
                  </Button>
                </div>
              </div>

              {/* PRD: Status */}
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v: any) => setFormData({ ...formData, status: v })}
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todo">○ To Do</SelectItem>
                    <SelectItem value="in_progress">◐ In Progress</SelectItem>
                    <SelectItem value="completed">● Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* PRD: Deadline (optional) - Planned Date defaults to today */}
              <div className="space-y-2">
                <Label htmlFor="deadline">Deadline (Optional)</Label>
                <Input
                  id="deadline"
                  type="date"
                  value={formData.deadline}
                  onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">Actual due date (planned date defaults to today)</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="goal">Link to Goal (Optional)</Label>
                <Select
                  value={formData.goalId || "none"}
                  onValueChange={(v) => setFormData({ ...formData, goalId: v === "none" ? "" : v })}
                >
                  <SelectTrigger id="goal">
                    <SelectValue placeholder="Select goal..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {goals.map((goal) => (
                      <SelectItem key={goal.id} value={goal.id}>
                        {goal.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Time Tracking Display (real-time sync) */}
              <div className="space-y-2 p-4 bg-muted/50 rounded-lg border">
                <Label className="text-sm font-semibold">Time Tracking</Label>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Estimated Time:</span>
                    <span className="font-medium">
                      {(() => {
                        const estimated = getEstimatedTimeInMinutes();
                        if (estimated === null) return "Not set";
                        return `${Math.floor(estimated / 60)}h ${estimated % 60}m`;
                      })()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Scheduled Time:</span>
                    <span className="font-medium">
                      {scheduledTime > 0 
                        ? `${Math.floor(scheduledTime / 60)}h ${scheduledTime % 60}m`
                        : "0h 0m"}
                    </span>
                  </div>
                  {(() => {
                    const estimated = getEstimatedTimeInMinutes();
                    if (estimated === null) return null;
                    const remaining = estimated - scheduledTime;
                    return (
                      <div className="flex justify-between items-center pt-2 border-t">
                        <span className="text-muted-foreground">Remaining:</span>
                        <span className={`font-medium flex items-center gap-1 ${
                          remaining > 0 ? "text-orange-600" : "text-green-600"
                        }`}>
                          {remaining > 0 ? (
                            <>
                              <AlertCircle className="w-4 h-4" />
                              {Math.floor(remaining / 60)}h {remaining % 60}m to schedule
                            </>
                          ) : (
                            "✓ Fully scheduled"
                          )}
                        </span>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* PRD: Work Time Blocks (now using time_segments) */}
              <div className="space-y-2">
                <Label>Work Time Blocks</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  These will sync to Gantt Chart & Google Calendar in real-time
                </p>
                <div className="space-y-3">
                  {formData.time_segments.map((seg, index) => {
                    // Extract date from start_time if date field is missing or empty
                    let dateStr: string;
                    if (seg.date && seg.date.trim() !== '') {
                      // Use date field if available and not empty
                      dateStr = seg.date.includes('T') ? seg.date.split('T')[0] : seg.date;
                    } else if (seg.start_time) {
                      // Extract date from ISO datetime string
                      dateStr = seg.start_time.split('T')[0];
                    } else {
                      // Fallback to today
                      dateStr = format(new Date(), "yyyy-MM-dd");
                    }
                    
                    // Extract time from ISO datetime strings
                    const startTime = seg.start_time 
                      ? format(parseISO(seg.start_time), "HH:mm") 
                      : "09:00";
                    const endTime = seg.end_time 
                      ? format(parseISO(seg.end_time), "HH:mm") 
                      : "10:00";
                    
                    return (
                      <div key={index} className="flex gap-2 items-end p-3 border rounded-lg">
                        <div className="flex-1">
                          <Label className="text-xs">Date</Label>
                          <Input
                            type="date"
                            value={dateStr}
                            onChange={(e) => updateWorkTimeBlock(index, "date", e.target.value)}
                          />
                        </div>
                        <div className="flex-1">
                          <Label className="text-xs">Start Time</Label>
                          <Input
                            type="time"
                            value={startTime}
                            onChange={(e) => updateWorkTimeBlock(index, "start_time", e.target.value)}
                          />
                        </div>
                        <div className="flex-1">
                          <Label className="text-xs">End Time</Label>
                          <Input
                            type="time"
                            value={endTime}
                            onChange={(e) => updateWorkTimeBlock(index, "end_time", e.target.value)}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeWorkTimeBlock(index)}
                          className="text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    );
                  })}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addWorkTimeBlock}
                    className="w-full"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Time Block
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tags">Tags</Label>
                <div className="flex gap-2">
                  <Input
                    id="tags"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                    placeholder="Add tag and press Enter"
                  />
                  <Button type="button" variant="outline" onClick={addTag}>
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="pl-3 pr-1">
                      {tag}
                      <button
                        onClick={() => removeTag(tag)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {editTask && (
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={loading || isDeleting}
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading || isDeleting}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={loading || isDeleting}>
              {loading ? "Saving..." : editTask ? "Update Task" : "Create Task"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

