import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { tasksApi } from "@/lib/api";
import { Loader2, Sparkles, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Subtask {
  title: string;
  description: string;
  estimatedMinutes: number;
  priority: "low" | "medium" | "high";
  tags: string[];
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  tags: string[];
  deadline: string | null;
}

interface AIBreakdownDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  parentTask?: Task | null;
}

export const AIBreakdownDialog = ({
  open,
  onOpenChange,
  onSuccess,
  parentTask,
}: AIBreakdownDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [taskInput, setTaskInput] = useState("");
  const [contextInput, setContextInput] = useState("");
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [selectedSubtasks, setSelectedSubtasks] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (open && parentTask) {
      setTaskInput(parentTask.title);
      setContextInput(parentTask.description || "");
    } else if (!open) {
      resetForm();
    }
  }, [open, parentTask]);

  const handleBreakdown = async () => {
    if (!taskInput.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter a task to break down",
      });
      return;
    }

    setLoading(true);

    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
      const { getClerkTokenGetter } = await import('@/lib/clerk-api');
      const getToken = getClerkTokenGetter();
      const token = getToken ? await getToken() : null;
      
      const taskToBreakDown = parentTask || { title: taskInput, description: contextInput };
      
      const response = await fetch(`${API_BASE_URL}/ai/task-breakdown`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ 
          taskTitle: taskToBreakDown.title,
          baseDescription: taskToBreakDown.description || undefined,
          extraContext: parentTask ? contextInput : undefined,
        }),
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.error || 'Failed to break down task');
      }

      const data = await response.json();
      
      if (!data.steps || data.steps.length === 0) {
        throw new Error('AI did not generate any steps. Please try again with a more detailed description.');
      }

      // Map steps to subtasks format (for compatibility with existing UI)
      const mappedSubtasks = data.steps.map((step: any) => ({
        title: step.title,
        description: step.description || '',
        estimatedMinutes: step.estimatedMinutes || 30,
        priority: 'medium' as const,
        tags: [],
      }));

      setSubtasks(mappedSubtasks);
      setSelectedSubtasks(new Set(mappedSubtasks.map((_: any, i: number) => i)));
      
      // Show notes if provided
      if (data.notesForUser) {
        toast({
          title: "✨ Task Breakdown Complete!",
          description: data.notesForUser,
        });
      }

      // Toast already shown above if notesForUser exists
      if (!data.notesForUser) {
        toast({
          title: "✨ Task Breakdown Complete!",
          description: `Generated ${data.steps.length} steps. Review and select which ones to create.`,
        });
      }
    } catch (error: any) {
      console.error("Breakdown error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to break down task. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleSubtask = (index: number) => {
    const newSelected = new Set(selectedSubtasks);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedSubtasks(newSelected);
  };

  const handleCreateTasks = async () => {
    if (selectedSubtasks.size === 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select at least one subtask",
      });
      return;
    }

    setLoading(true);

    try {
      // Get max order for existing subtasks if parent exists
      let maxOrder = -1;
      if (parentTask?.id) {
        try {
          const allTasks = await tasksApi.getAll() as any[];
          const existingSubtasks = allTasks.filter(t => t.parent_task_id === parentTask.id);
          if (existingSubtasks.length > 0) {
            maxOrder = Math.max(...existingSubtasks.map(t => t.order || 0));
          }
        } catch (error) {
          console.error("Failed to get existing subtasks:", error);
        }
      } else {
        // For top-level tasks, get max order from all tasks
        try {
          const allTasks = await tasksApi.getAll() as any[];
          const topLevelTasks = allTasks.filter(t => !t.parent_task_id);
          if (topLevelTasks.length > 0) {
            maxOrder = Math.max(...topLevelTasks.map(t => t.order || 0));
          }
        } catch (error) {
          console.error("Failed to get existing tasks:", error);
        }
      }

      const tasksToCreate = Array.from(selectedSubtasks)
        .sort((a, b) => a - b) // Maintain order
        .map((index, arrayIndex) => {
          const subtask = subtasks[index];
          return {
            title: subtask.title,
            description: subtask.description || null,
            estimated_minutes: subtask.estimatedMinutes || null,
            priority: subtask.priority,
            tags: subtask.tags || [],
            status: "todo" as const,
            parent_task_id: parentTask?.id || null,
            deadline: parentTask?.deadline || null, // Inherit parent's deadline if exists
            order: maxOrder + arrayIndex + 1,
          };
        });

      // Create all tasks
      await Promise.all(tasksToCreate.map(taskData => tasksApi.create(taskData)));

      toast({
        title: "Success!",
        description: `Created ${tasksToCreate.length} ${
          parentTask ? "subtask" + (tasksToCreate.length > 1 ? "s" : "") : "task" + (tasksToCreate.length > 1 ? "s" : "")
        }`,
      });

      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create tasks",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTaskInput("");
    setContextInput("");
    setSubtasks([]);
    setSelectedSubtasks(new Set());
  };

  const getPriorityColor = (priority: string): "default" | "destructive" | "secondary" => {
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary animate-pulse" />
            AI Task Breakdown
          </DialogTitle>
          <DialogDescription>
            {parentTask
              ? `AI Suggestions for "${parentTask.title}": Select which subtasks to add. Existing subtasks will not be affected.`
              : "Describe a complex task and AI will break it down into manageable steps"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {parentTask && (
            <div className="space-y-2">
              <Label>Task</Label>
              <div className="p-3 bg-muted rounded-md">
                <p className="font-medium">{parentTask.title}</p>
                {parentTask.description && (
                  <p className="text-sm text-muted-foreground mt-1">{parentTask.description}</p>
                )}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="context">
              {parentTask ? "Add more details to improve the breakdown (optional)" : "What do you need to do? *"}
            </Label>
            <Textarea
              id="context"
              value={parentTask ? contextInput : taskInput}
              onChange={(e) => {
                if (parentTask) {
                  setContextInput(e.target.value);
                } else {
                  setTaskInput(e.target.value);
                }
              }}
              placeholder={parentTask 
                ? "e.g., This is for a group project, needs to be done by Friday, requires research on recent papers"
                : "e.g., Prepare my final presentation for Computer Science"}
              rows={parentTask ? 3 : 2}
            />
          </div>

          {!parentTask && (
            <div className="space-y-2">
              <Label htmlFor="extraContext">Additional context (optional)</Label>
              <Textarea
                id="extraContext"
                value={contextInput}
                onChange={(e) => setContextInput(e.target.value)}
                placeholder="e.g., 15-minute presentation, needs slides and demo, due Friday"
                rows={2}
              />
            </div>
          )}

          {subtasks.length === 0 ? (
            <div className="flex gap-2">
              <Button onClick={handleBreakdown} disabled={loading || (!parentTask && !taskInput.trim())} className="flex-1">
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating breakdown...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate breakdown
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">
                  {parentTask ? "AI Suggestions" : "Select tasks to create:"}
                </h3>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const allSelected = selectedSubtasks.size === subtasks.length;
                      if (allSelected) {
                        setSelectedSubtasks(new Set());
                      } else {
                        setSelectedSubtasks(new Set(subtasks.map((_, i) => i)));
                      }
                    }}
                  >
                    {selectedSubtasks.size === subtasks.length ? "Deselect All" : "Select All"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setSubtasks([])}>
                    Start Over
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                {subtasks.map((subtask, index) => (
                  <Card
                    key={index}
                    className={`p-4 cursor-pointer transition-all ${
                      selectedSubtasks.has(index)
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border hover:border-primary/50"
                    }`}
                    onClick={() => toggleSubtask(index)}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center mt-1 flex-shrink-0 ${
                          selectedSubtasks.has(index)
                            ? "bg-primary border-primary"
                            : "border-muted-foreground"
                        }`}
                      >
                        {selectedSubtasks.has(index) && (
                          <Plus className="w-3 h-3 text-white" />
                        )}
                      </div>
                      <div className="flex-1 space-y-2">
                        <h4 className="font-medium">{subtask.title}</h4>
                        {subtask.description && (
                          <p className="text-sm text-muted-foreground">
                            {subtask.description}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2">
                          <Badge
                            variant="outline"
                            className={getPriorityClassName(subtask.priority)}
                          >
                            {subtask.priority}
                          </Badge>
                          {subtask.estimatedMinutes && (
                            <Badge variant="outline">
                              {subtask.estimatedMinutes} min
                            </Badge>
                          )}
                          {subtask.tags.map((tag) => (
                            <Badge key={tag} variant="secondary">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateTasks}
                  disabled={loading || selectedSubtasks.size === 0}
                  className="flex-1"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      Add these as subtasks ({selectedSubtasks.size})
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
