import React, { useState, useEffect } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { X, Calendar } from "lucide-react";
import { TimeSegment } from "@/types/timeSegment";
import { parseISO, isWithinInterval } from "date-fns";

interface OverlapWarningProps {
  segment: TimeSegment;
  allSegments: TimeSegment[];
  onDismiss: () => void;
}

export const OverlapWarning: React.FC<OverlapWarningProps> = ({
  segment,
  allSegments,
  onDismiss,
}) => {
  const [overlappingSegments, setOverlappingSegments] = useState<TimeSegment[]>([]);

  useEffect(() => {
    const segmentStart = parseISO(segment.start_time);
    const segmentEnd = parseISO(segment.end_time);
    const segmentInterval = { start: segmentStart, end: segmentEnd };

    const overlaps = allSegments.filter((other) => {
      if (other.id === segment.id || other.deleted_at) return false;

      const otherStart = parseISO(other.start_time);
      const otherEnd = parseISO(other.end_time);

      // Check if segments overlap
      return (
        (isWithinInterval(otherStart, segmentInterval) ||
          isWithinInterval(otherEnd, segmentInterval) ||
          isWithinInterval(segmentStart, { start: otherStart, end: otherEnd }) ||
          isWithinInterval(segmentEnd, { start: otherStart, end: otherEnd })) &&
        other.date === segment.date
      );
    });

    setOverlappingSegments(overlaps);
  }, [segment, allSegments]);

  if (overlappingSegments.length === 0) return null;

  return (
    <Alert className="mb-2 border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
      <AlertTitle className="flex items-center justify-between">
        <span className="flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          Time Conflict
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onDismiss}
        >
          <X className="w-4 h-4" />
        </Button>
      </AlertTitle>
      <AlertDescription>
        <div className="space-y-1">
          <p>Overlaps with:</p>
          <ul className="list-disc list-inside space-y-1">
            {overlappingSegments.map((overlap) => (
              <li key={overlap.id} className="text-sm">
                <strong>{overlap.title}</strong> (
                {new Date(overlap.start_time).toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                })}{" "}
                -{" "}
                {new Date(overlap.end_time).toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                })}
                )
              </li>
            ))}
          </ul>
        </div>
      </AlertDescription>
    </Alert>
  );
};

