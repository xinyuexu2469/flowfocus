import React from "react";

interface TimelineHeaderProps {
  startHour: number;
  endHour: number;
  headerRef?: React.RefObject<HTMLDivElement>;
}

export const TimelineHeader: React.FC<TimelineHeaderProps> = ({
  startHour,
  endHour,
  headerRef,
}) => {
  const totalHours = endHour - startHour;

  return (
    <div 
      ref={headerRef}
      className="border-b border-border bg-muted/30 sticky top-0 z-20 overflow-x-hidden timeline-header-no-scrollbar"
    >
      <div className="relative h-12" style={{ minWidth: `${totalHours * 100}px` }}>
        {Array.from({ length: totalHours + 1 }, (_, i) => {
          const hour = startHour + i;
          const leftPercent = (i / totalHours) * 100;
          const hourLabel = hour === 0 || hour === 24
            ? "12a"
            : hour < 12
            ? `${hour}a`
            : hour === 12
            ? "12p"
            : `${hour - 12}p`;

          return (
            <div
              key={hour}
              className="absolute top-0 bottom-0 border-l border-border/50 flex items-center justify-center"
              style={{ left: `${leftPercent}%` }}
            >
              <span className="text-xs text-muted-foreground font-medium px-1">
                {hourLabel}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

