import React, { useRef, useState, useEffect } from "react";
import { useMonthlyGanttStore } from "@/stores/monthlyGanttStore";
import { format, startOfMonth, endOfMonth, eachWeekOfInterval, startOfWeek, endOfWeek, parseISO } from "date-fns";
import { ProjectBar } from "./ProjectBar";

export const ProjectTimelinePanel: React.FC = () => {
  const { selectedMonth, getProjectsForMonth } = useMonthlyGanttStore();
  const timelineRef = useRef<HTMLDivElement>(null);

  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfMonth(selectedMonth);
  const weeks = eachWeekOfInterval(
    { start: startOfWeek(monthStart), end: endOfWeek(monthEnd) },
    { weekStartsOn: 0 }
  );

  const visibleProjects = getProjectsForMonth(selectedMonth);

  // Calculate column width as a fraction (1 / number of weeks)
  // Use the same calculation for both header and body to ensure perfect alignment
  const columnWidthPercent = 100 / weeks.length;

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      {/* Timeline Header */}
      <div className="border-b border-border bg-muted/30 sticky top-0 z-10">
        <div className="flex">
          <div className="w-0 flex-shrink-0" /> {/* Spacer for project list */}
          <div className="flex-1 flex px-2">
            {weeks.map((week, weekIndex) => (
              <div
                key={weekIndex}
                className="text-center p-2 border-r border-border last:border-r-0 flex-shrink-0"
                style={{ width: `${columnWidthPercent}%` }}
              >
                <div className="text-xs font-medium">
                  {format(week, "MMM d")}
                </div>
                <div className="text-xs text-muted-foreground">
                  Week {format(week, "w")}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Timeline Grid */}
      <div
        ref={timelineRef}
        className="flex-1 overflow-x-auto overflow-y-auto relative"
      >
        {/* Week grid lines - aligned with header columns using same calculation */}
        <div className="absolute inset-0 pointer-events-none">
          {weeks.map((week, weekIndex) => {
            const leftPercent = weekIndex * columnWidthPercent;
            return (
              <div
                key={weekIndex}
                className="absolute top-0 bottom-0 border-l border-border/50"
                style={{ left: `${leftPercent}%` }}
              />
            );
          })}
        </div>

        {/* Project rows */}
        <div className="relative">
          {visibleProjects.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No projects for {format(selectedMonth, "MMMM yyyy")}. Click "Add Project" to create one.
            </div>
          ) : (
            visibleProjects.map((project) => (
              <div
                key={project.id}
                className="relative border-b border-border/50 h-16 hover:bg-muted/30"
              >
                <ProjectBar
                  project={project}
                  monthStart={monthStart}
                  monthEnd={monthEnd}
                  weeks={weeks}
                />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

