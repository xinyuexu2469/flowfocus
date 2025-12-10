import { useState, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { getClerkTokenGetter } from "@/lib/clerk-api";
import { Loader2, Bot, Send, Check, X, Calendar, Clock, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, parseISO } from "date-fns";
import { useDailyGanttStore } from "@/stores/dailyGanttStore";
import { useTaskStore } from "@/stores/taskStore";
import { tasksApi, timeSegmentsApi } from "@/lib/api";

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface PlannedTask {
  id: string;
  title: string;
  description?: string;
  estimatedMinutes: number;
  priority: "low" | "medium" | "high";
  tags: string[];
  parentTaskId?: string;
  timeBlocks: Array<{
    date: string; // ISO date string
    startTime: string; // HH:mm format
    endTime: string; // HH:mm format
  }>;
  order: number;
}

interface AIPlanningAssistantProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const AIPlanningAssistant = ({
  open,
  onOpenChange,
  onSuccess,
}: AIPlanningAssistantProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [plannedTasks, setPlannedTasks] = useState<PlannedTask[]>([]);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { fetchTasks } = useTaskStore();
  const { fetchSegmentsForDate } = useDailyGanttStore();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Initialize with welcome message
  useEffect(() => {
    if (open && messages.length === 0) {
      const welcomeMessage: Message = {
        id: "welcome",
        role: "assistant",
        content:
          "Hi there! I’m your planning buddy—warm and gentle like a big sister. Tell me what you want to do today/this week and any deadlines or fixed events. If you’re not sure yet, I can show a tiny example and ask a few gentle questions so we can plan based on your situation.",
        timestamp: new Date(),
      };
      setMessages([welcomeMessage]);
      setPlannedTasks([]);
      setSelectedTaskIds(new Set());
      setInput("");
    }
  }, [open]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    // If the user only says hi or gives too little info, respond gently without calling backend
    const trimmed = input.trim();
    if (trimmed.length < 6) {
      const gentleReply: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content:
          "Tell me a bit more—what you need to do, deadlines, available hours, or existing events. I can share a quick example if you like, but I’ll wait for your details to tailor the plan.",
        timestamp: new Date(),
      };
      setMessages([...messages, userMessage, gentleReply]);
      setInput("");
      return;
    }

    // Update messages state and create the full messages array for the API call
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);
    setIsGenerating(true);

    try {
      const getToken = getClerkTokenGetter();
      const token = getToken ? await getToken() : null;
      const response = await fetch(`${API_BASE_URL}/ai/planning`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        mode: "cors",
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate plan");
      }

      const data = await response.json();
      
      // Add AI response message with summary and notes
      const responseContent = [data.summary, data.notesForUser].filter(Boolean).join('\n\n');
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: responseContent || "I've generated a plan for you. Please check the preview on the right. You can continue the conversation to adjust the plan.",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiMessage]);

      // Update planned tasks - map from new format to existing PlannedTask format
      if (data.tasks && Array.isArray(data.tasks)) {
        const mappedTasks = data.tasks.map((task: any, index: number) => ({
          id: `task_${Date.now()}_${index}`,
          title: task.title,
          description: task.description || '',
          estimatedMinutes: task.estimatedMinutes || 30,
          priority: task.priority || 'medium',
          tags: [], // New API doesn't include tags, keep empty for now
          parentTaskId: undefined,
          timeBlocks: (task.workTimeBlocks || []).map((block: any) => ({
            date: block.date,
            startTime: block.startTime,
            endTime: block.endTime,
          })),
          order: index,
        }));
        setPlannedTasks(mappedTasks);
        // 默认不勾选，让用户确认想保留的任务
        setSelectedTaskIds(new Set());
      }

      toast({
        title: "✨ Plan Generated",
        description: `Generated ${data.tasks?.length || 0} task${data.tasks?.length !== 1 ? 's' : ''}`,
      });
    } catch (error: any) {
      console.error("Planning error:", error);
      const errorMsg = error.message || "Unknown error";
      // 提供更详细的错误信息
      let userFriendlyError = errorMsg;
      if (errorMsg.includes("Failed to fetch") || errorMsg.includes("NetworkError")) {
        userFriendlyError = "无法连接到服务器。请检查后端服务器是否在运行 (http://localhost:4000)";
      }
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `抱歉，生成计划时出现错误：${userFriendlyError}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      toast({
        variant: "destructive",
        title: "错误",
        description: userFriendlyError,
      });
    } finally {
      setLoading(false);
      setIsGenerating(false);
    }
  };

  const handleCreateSchedule = async () => {
    if (plannedTasks.length === 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No tasks to create",
      });
      return;
    }

    const tasksToCreate = plannedTasks.filter((t) =>
      selectedTaskIds.has(t.id)
    );

    if (tasksToCreate.length === 0) {
      toast({
        variant: "destructive",
        title: "没有选择任务",
        description: "先勾选想要创建的任务，或直接关闭窗口。",
      });
      return;
    }

    setIsCreating(true);

    try {
      // Get max order for existing tasks
      const allTasks = await tasksApi.getAll();
      const topLevelTasks = allTasks.filter((t: any) => !t.parent_task_id);
      const maxOrder = topLevelTasks.length > 0 
        ? Math.max(...topLevelTasks.map((t: any) => t.order || 0))
        : -1;

      // Create tasks with hierarchy
      const taskIdMap = new Map<string, string>(); // plannedTask.id -> created task id
      let currentOrder = maxOrder + 1;

      // First pass: Create all tasks
      for (const plannedTask of tasksToCreate) {
        // planned_date is required by backend; fall back to first time block date or today
        const firstBlockDate = plannedTask.timeBlocks[0]?.date || new Date().toISOString().split("T")[0];
        const taskData = {
          title: plannedTask.title,
          description: plannedTask.description || null,
          estimated_minutes: plannedTask.estimatedMinutes,
          priority: plannedTask.priority,
          tags: plannedTask.tags || [],
          status: "todo" as const,
          planned_date: firstBlockDate, // ensure backend required field is populated
          parent_task_id: plannedTask.parentTaskId 
            ? taskIdMap.get(plannedTask.parentTaskId) || null 
            : null,
          order: currentOrder++,
        };

        const createdTask = await tasksApi.create(taskData);
        taskIdMap.set(plannedTask.id, createdTask.id);

        // Create time segments for this task
        for (const timeBlock of plannedTask.timeBlocks) {
          const blockDate = timeBlock.date || firstBlockDate;
          const startDateTime = new Date(`${blockDate}T${timeBlock.startTime}:00`);
          const endDateTime = new Date(`${blockDate}T${timeBlock.endTime}:00`);
          
          await timeSegmentsApi.create({
            task_id: createdTask.id,
            date: blockDate,
            start_time: startDateTime.toISOString(),
            end_time: endDateTime.toISOString(),
            title: plannedTask.title,
            title_is_custom: false,
            source: "task",
          });
        }
      }

      // Refresh stores
      await fetchTasks();
      const today = new Date();
      await fetchSegmentsForDate(today);

      const totalBlocks = tasksToCreate.reduce((sum, t) => sum + t.timeBlocks.length, 0);
      toast({
        title: "✅ Schedule Created",
        description: `Created ${tasksToCreate.length} task${tasksToCreate.length !== 1 ? 's' : ''} and ${totalBlocks} time block${totalBlocks !== 1 ? 's' : ''}`,
      });

      onSuccess();
      onOpenChange(false);
      reset();
    } catch (error: any) {
      console.error("Create schedule error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create schedule. Please try again.",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const reset = () => {
    setMessages([]);
    setPlannedTasks([]);
    setSelectedTaskIds(new Set());
    setInput("");
  };

  const toggleTaskSelection = (taskId: string) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const selectAllTasks = () => {
    setSelectedTaskIds(new Set(plannedTasks.map((t) => t.id)));
  };

  const clearSelectedTasks = () => {
    setSelectedTaskIds(new Set());
  };

  const selectedCount = useMemo(() => selectedTaskIds.size, [selectedTaskIds]);

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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-calm flex items-center justify-center">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold">AI Planning Assistant</h2>
            <p className="text-sm text-muted-foreground">Intelligent Planning Assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {plannedTasks.length > 0 && (
            <Button
              onClick={handleCreateSchedule}
              disabled={isCreating || selectedCount === 0}
              className="gap-2"
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Create Selected ({selectedCount} task{selectedCount !== 1 ? 's' : ''})
                </>
              )}
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Main Content: Split View */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Chat Interface */}
        <div className="w-1/2 border-r border-border flex flex-col">
          <ScrollArea className="flex-1 p-6">
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {message.role === "assistant" && (
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Bot className="w-4 h-4 text-primary" />
                    </div>
                  )}
                  <Card
                    className={`max-w-[80%] p-4 ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                    <p className="text-xs opacity-70 mt-2">
                      {format(message.timestamp, "HH:mm")}
                    </p>
                  </Card>
                  {message.role === "user" && (
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                      <span className="text-xs">You</span>
                    </div>
                  )}
                </div>
              ))}
              {isGenerating && (
                <div className="flex gap-3 justify-start">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                  <Card className="bg-muted p-4">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">AI is thinking...</span>
                    </div>
                  </Card>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Input Area */}
          <div className="border-t border-border p-4">
            <div className="flex gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Describe your tasks and situation..."
                rows={3}
                className="resize-none"
              />
              <Button
                onClick={handleSend}
                disabled={loading || !input.trim()}
                size="icon"
                className="h-auto"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Press Enter to send, Shift+Enter for new line
            </p>
          </div>
        </div>

        {/* Right: Real-time Preview */}
        <div className="w-1/2 flex flex-col overflow-hidden">
          {plannedTasks.length === 0 ? (
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="text-center space-y-4">
                <Sparkles className="w-16 h-16 text-muted-foreground mx-auto" />
                <div>
                  <h3 className="text-lg font-semibold mb-2">Waiting for Plan Generation</h3>
                  <p className="text-sm text-muted-foreground">
                    Enter your task description on the left, and AI will generate the task list and time schedule here
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <ScrollArea className="flex-1 p-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-4">Task List</h3>
                  <div className="flex items-center gap-2 mb-3 text-sm text-muted-foreground">
                    <span>生成后请勾选想保留的任务（不满意可以一个都不选）</span>
                    <Button variant="ghost" size="sm" onClick={selectAllTasks} className="h-7 px-2">
                      全选
                    </Button>
                    <Button variant="ghost" size="sm" onClick={clearSelectedTasks} className="h-7 px-2">
                      清空
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {plannedTasks
                      .filter((t) => !t.parentTaskId)
                      .map((task) => {
                        const subtasks = plannedTasks.filter(
                          (t) => t.parentTaskId === task.id
                        );
                        return (
                          <Card key={task.id} className="p-4">
                            <div className="space-y-2">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-2 flex-1">
                                  <Checkbox
                                    checked={selectedTaskIds.has(task.id)}
                                    onCheckedChange={() => toggleTaskSelection(task.id)}
                                    className="mt-1"
                                  />
                                  <div className="flex-1">
                                    <h4 className="font-medium">{task.title}</h4>
                                    {task.description && (
                                      <p className="text-sm text-muted-foreground mt-1">
                                        {task.description}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <Badge
                                  variant="outline"
                                  className={getPriorityClassName(task.priority)}
                                >
                                  {task.priority}
                                </Badge>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Badge variant="outline" className="gap-1">
                                  <Clock className="w-3 h-3" />
                                  {Math.floor(task.estimatedMinutes / 60)}h{" "}
                                  {task.estimatedMinutes % 60}m
                                </Badge>
                                {task.tags.map((tag) => (
                                  <Badge key={tag} variant="secondary">
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                              {task.timeBlocks.length > 0 && (
                                <div className="mt-2 space-y-1">
                                  <p className="text-xs font-medium text-muted-foreground">
                                    Time Schedule:
                                  </p>
                                  {task.timeBlocks.map((block, idx) => (
                                    <div
                                      key={idx}
                                      className="text-xs text-muted-foreground flex items-center gap-2"
                                    >
                                      <Calendar className="w-3 h-3" />
                                      {format(parseISO(block.date), "MMM dd")} {block.startTime} - {block.endTime}
                                    </div>
                                  ))}
                                </div>
                              )}
                              {subtasks.length > 0 && (
                                <div className="mt-3 pl-4 border-l-2 border-muted space-y-2">
                                  {subtasks.map((subtask) => (
                                    <Card key={subtask.id} className="p-3 bg-muted/50">
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-start gap-2 flex-1">
                                          <Checkbox
                                            checked={selectedTaskIds.has(subtask.id)}
                                            onCheckedChange={() => toggleTaskSelection(subtask.id)}
                                            className="mt-1"
                                          />
                                          <div className="flex-1">
                                            <h5 className="text-sm font-medium">
                                              {subtask.title}
                                            </h5>
                                            {subtask.description && (
                                              <p className="text-xs text-muted-foreground mt-1">
                                                {subtask.description}
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                        <Badge
                                          variant="outline"
                                          className={`text-xs ${getPriorityClassName(subtask.priority)}`}
                                        >
                                          {subtask.priority}
                                        </Badge>
                                      </div>
                                    </Card>
                                  ))}
                                </div>
                              )}
                            </div>
                          </Card>
                        );
                      })}
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}
        </div>
      </div>
    </div>
  );
};

