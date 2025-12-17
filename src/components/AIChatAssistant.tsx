import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, X, Send, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTaskStore } from "@/stores/taskStore";
import { useDailyGanttStore } from "@/stores/dailyGanttStore";
import { format } from "date-fns";
import { API_BASE_URL } from "@/lib/api";
import { getClerkTokenGetter } from "@/lib/clerk-api";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export const AIChatAssistant = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hello! I'm your AI companion. I'm here to help you reflect on your day, manage your time better, and offer gentle coaching and support. How are you feeling about your schedule today?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { tasks, fetchTasks, getTasksForDate, selectedDate } = useTaskStore();
  const { segments, getSegmentsForDate } = useDailyGanttStore();

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);

    try {
      const getToken = getClerkTokenGetter();
      const token = getToken ? await getToken() : null;
      
      const response = await fetch(`${API_BASE_URL}/ai/companion`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          messages: updatedMessages.map(m => ({
            role: m.role,
            content: m.content,
          })),
        }),
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.error || 'Failed to get AI response');
      }

      const data = await response.json();
      const assistantMessage: Message = {
        role: "assistant",
        content: data.reply || 'I apologize, but I could not generate a response.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error('AI Companion error:', error);
      const errorMessage: Message = {
        role: "assistant",
        content: `Sorry, I'm having trouble connecting right now. ${error.message || 'Please try again later.'}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Legacy function - kept for reference but not used anymore
  const generateAIResponse = (userInput: string): string => {
    const lowerInput = userInput.toLowerCase();

    // Query schedule
    if (lowerInput.includes("what") && (lowerInput.includes("tomorrow") || lowerInput.includes("today"))) {
      const date = lowerInput.includes("tomorrow")
        ? new Date(selectedDate.getTime() + 24 * 60 * 60 * 1000)
        : selectedDate;
      const tasksForDate = getTasksForDate(date);
      const segmentsForDate = getSegmentsForDate(date);

      if (tasksForDate.length === 0 && segmentsForDate.length === 0) {
        return `You have no tasks or scheduled time blocks for ${format(date, "MMMM d, yyyy")}. Would you like me to help you plan your day?`;
      }

      let response = `Here's your schedule for ${format(date, "MMMM d, yyyy")}:\n\n`;
      
      if (tasksForDate.length > 0) {
        response += `**Tasks (${tasksForDate.length}):**\n`;
        tasksForDate.forEach((task, index) => {
          response += `${index + 1}. ${task.title} (${task.priority} priority, ${task.status})\n`;
        });
        response += "\n";
      }

      if (segmentsForDate.length > 0) {
        response += `**Scheduled Time Blocks (${segmentsForDate.length}):**\n`;
        segmentsForDate.forEach((segment, index) => {
          const task = tasks.find((t) => t.id === segment.task_id);
          const startTime = format(new Date(segment.start_time), "h:mm a");
          const endTime = format(new Date(segment.end_time), "h:mm a");
          response += `${index + 1}. ${task?.title || "Untitled"} (${startTime} - ${endTime})\n`;
        });
      }

      return response;
    }

    // Move task
    if (lowerInput.includes("move") && lowerInput.includes("to")) {
      return "I can help you move tasks! Please specify which task you'd like to move and when. For example: 'Move 'Write paper' to tomorrow at 2pm'";
    }

    // Create task
    if (lowerInput.includes("add") || lowerInput.includes("create")) {
      return "I can help you create tasks! Please provide more details. For example: 'Add a 2-hour study session on Wednesday afternoon'";
    }

    // Optimize schedule
    if (lowerInput.includes("optimize") || lowerInput.includes("schedule")) {
      return "I can help optimize your schedule! I'll analyze your tasks and time blocks to suggest the best arrangement. This feature is coming soon!";
    }

    // Default response
    return "I understand you're asking about your schedule. I can help you:\n\n" +
      "• View your schedule: 'What do I have tomorrow?'\n" +
      "• Move tasks: 'Move my thesis work to tomorrow afternoon'\n" +
      "• Create tasks: 'Add 2-hour study session on Wednesday'\n" +
      "• Optimize schedule: 'Optimize my schedule for this week'\n\n" +
      "What would you like to do?";
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <Button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50 bg-gradient-calm hover:opacity-90"
          size="icon"
        >
          <MessageCircle className="h-6 w-6 text-white" />
        </Button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <Card className="fixed bottom-6 right-6 w-96 h-[600px] shadow-2xl z-50 flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">AI Assistant</h3>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
            <div className="space-y-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={cn(
                    "flex",
                    message.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[80%] rounded-lg p-3",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    )}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    <p className="text-xs opacity-70 mt-1">
                      {format(message.timestamp, "h:mm a")}
                    </p>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg p-3">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="p-4 border-t border-border">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me anything about your schedule..."
                disabled={isLoading}
                className="flex-1"
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                size="icon"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      )}
    </>
  );
};

