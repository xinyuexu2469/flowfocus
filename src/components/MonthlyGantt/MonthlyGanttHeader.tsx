import React from "react";
import { useMonthlyGanttStore } from "@/stores/monthlyGanttStore";
import { format, addMonths, subMonths } from "date-fns";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

export const MonthlyGanttHeader: React.FC = () => {
  const { selectedMonth, setSelectedMonth } = useMonthlyGanttStore();

  const navigateMonth = (direction: "prev" | "next" | "today") => {
    if (direction === "today") {
      setSelectedMonth(new Date());
    } else if (direction === "prev") {
      setSelectedMonth(subMonths(selectedMonth, 1));
    } else {
      setSelectedMonth(addMonths(selectedMonth, 1));
    }
  };

  return (
    <div className="monthly-gantt-header border-b bg-card px-4 py-3 flex items-center justify-between">
      {/* Left: Month navigation */}
      <div className="flex items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Calendar className="w-4 h-4" />
              {format(selectedMonth, "MMMM yyyy")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <CalendarComponent
              mode="single"
              selected={selectedMonth}
              onSelect={(date) => date && setSelectedMonth(date)}
              className="rounded-md border"
            />
          </PopoverContent>
        </Popover>

        <Button variant="ghost" size="sm" onClick={() => navigateMonth("prev")}>
          <ChevronLeft className="w-4 h-4" />
          Prev
        </Button>

        <Button variant="ghost" size="sm" onClick={() => navigateMonth("today")}>
          Today
        </Button>

        <Button variant="ghost" size="sm" onClick={() => navigateMonth("next")}>
          Next
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

