import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useTaskStore } from "@/stores/taskStore";
import { getTaskBoxDates } from "@/utils/taskBoxUtils";

interface CalendarToolbarProps {
  currentView: string;
  onViewChange: (view: string) => void;
  onToday: () => void;
  onPrev: () => void;
  onNext: () => void;
  currentDate: Date;
  onDateSelect: (date: Date) => void;
}

export function CalendarToolbar({
  currentView,
  onViewChange,
  onToday,
  onPrev,
  onNext,
  currentDate,
  onDateSelect,
}: CalendarToolbarProps) {
  const { tasks, segmentsByTask } = useTaskStore();
  const viewOptions = [
    { value: "timeGridDay", label: "Day" },
    { value: "timeGridWeek", label: "Week" },
    { value: "dayGridMonth", label: "Month" },
    { value: "listWeek", label: "Agenda" },
  ];

  // Build set of dates that have tasks (for indicator dots in date picker)
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
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onPrev}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={onNext}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={onToday}>
          Today
        </Button>

        {/* Compact date picker button - similar to Tasks tab */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "w-[200px] justify-start text-left font-normal",
                !currentDate && "text-muted-foreground"
              )}
            >
              <Calendar className="mr-2 h-4 w-4" />
              {currentDate ? format(currentDate, "PPP") : "Pick a date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CalendarComponent
              mode="single"
              selected={currentDate}
              onSelect={(date) => {
                if (date) {
                  onDateSelect(date);
                }
              }}
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
      </div>

      <div className="flex items-center gap-2">
        <Select value={currentView} onValueChange={onViewChange}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {viewOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
