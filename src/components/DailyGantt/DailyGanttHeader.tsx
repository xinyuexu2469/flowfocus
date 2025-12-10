import React from "react";
import { useDailyGanttStore } from "@/stores/dailyGanttStore";
import { useTaskStore } from "@/stores/taskStore";
import { format, addDays, subDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar, ZoomIn, ZoomOut } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { getTaskBoxDates } from "@/utils/taskBoxUtils";

export const DailyGanttHeader: React.FC = () => {
  const { selectedDate, setSelectedDate } = useDailyGanttStore();
  const { tasks, segmentsByTask } = useTaskStore();
  
  const goToPreviousDay = () => setSelectedDate(subDays(selectedDate, 1));
  const goToToday = () => setSelectedDate(new Date());
  const goToNextDay = () => setSelectedDate(addDays(selectedDate, 1));
  
  // Build set of dates that have tasks (for indicator dots in date picker)
  // Same approach as Calendar and Kanban
  const taskBoxDateSet = new Set<string>();
  for (const task of tasks) {
    if (task.status === "completed" || task.parent_task_id) {
      continue;
    }
    const boxDates = getTaskBoxDates(task, segmentsByTask);
    for (const d of boxDates) {
      const key = format(d, "yyyy-MM-dd");
      taskBoxDateSet.add(key);
    }
  }

  // Convert Set to array of Date objects for modifiers
  const datesWithTasks = Array.from(taskBoxDateSet).map((dateStr) => {
    return new Date(dateStr + 'T00:00:00');
  });

  return (
    <div className="daily-gantt-header border-b bg-card px-4 py-3 flex items-center justify-between">
      {/* Left: Date navigation */}
      <div className="flex items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Calendar className="w-4 h-4" />
              {format(selectedDate, "EEEE, MMM d, yyyy")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <CalendarComponent
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              modifiers={{
                hasTasks: datesWithTasks,
              }}
              modifiersClassNames={{
                hasTasks: "relative after:content-[''] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1.5 after:h-1.5 after:bg-red-500 after:rounded-full",
              }}
              className="rounded-md border"
            />
          </PopoverContent>
        </Popover>
        
        <Button variant="ghost" size="sm" onClick={goToPreviousDay}>
          <ChevronLeft className="w-4 h-4" />
          Prev
        </Button>
        
        <Button variant="ghost" size="sm" onClick={goToToday}>
          Today
        </Button>
        
        <Button variant="ghost" size="sm" onClick={goToNextDay}>
          Next
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

