import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { useDailyGanttStore } from "@/stores/dailyGanttStore";
import { useTaskStore } from "@/stores/taskStore";
import { TimeSegment } from "@/types/timeSegment";
import { format, parseISO, addMinutes, differenceInMinutes } from "date-fns";
import { ChevronDown, ChevronUp, RotateCcw, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { OverlapWarning } from "./OverlapWarning";

interface TimeSegmentEditorProps {
  segment: TimeSegment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const TimeSegmentEditor: React.FC<TimeSegmentEditorProps> = ({
  segment,
  open,
  onOpenChange,
}) => {
  const { updateSegment, deleteSegment, segments } = useDailyGanttStore();
  const { tasks } = useTaskStore();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [titleIsCustom, setTitleIsCustom] = useState(false);
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [duration, setDuration] = useState(60);
  const [status, setStatus] = useState<"planned" | "in-progress" | "completed">("planned");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [color, setColor] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  // Get linked task
  const linkedTask = segment ? tasks.find((t) => t.id === segment.task_id) : null;

  // Initialize form when segment changes
  useEffect(() => {
    if (segment) {
      setTitle(segment.title);
      setTitleIsCustom(segment.title_is_custom);
      setDate(segment.date);
      setStartTime(format(parseISO(segment.start_time), "HH:mm"));
      setEndTime(format(parseISO(segment.end_time), "HH:mm"));
      setDuration(segment.duration || 60);
      setStatus(segment.status);
      setDescription(segment.description || "");
      setNotes(segment.notes || "");
      setColor(segment.color || "");
      setTags(segment.tags || []);
    }
  }, [segment]);

  // Calculate duration when times change
  useEffect(() => {
    if (date && startTime && endTime) {
      try {
        const start = parseISO(`${date}T${startTime}:00`);
        const end = parseISO(`${date}T${endTime}:00`);
        const diff = differenceInMinutes(end, start);
        if (diff > 0) {
          setDuration(diff);
        }
      } catch (e) {
        // Invalid time format
      }
    }
  }, [date, startTime, endTime]);

  const handleSave = async () => {
    if (!segment) return;

    setLoading(true);
    try {
      const startDateTime = parseISO(`${date}T${startTime}:00`).toISOString();
      const endDateTime = parseISO(`${date}T${endTime}:00`).toISOString();

      await updateSegment(segment.id, {
        title,
        title_is_custom: titleIsCustom,
        date,
        start_time: startDateTime,
        end_time: endDateTime,
        duration,
        status,
        description: description || null,
        notes: notes || null,
        color: color || null,
        tags: tags.length > 0 ? tags : null,
      });

      toast({
        title: "Segment updated",
        description: "Time segment has been saved.",
      });

      onOpenChange(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update segment",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!segment) return;

    if (!confirm("Are you sure you want to delete this segment?")) return;

    setLoading(true);
    try {
      await deleteSegment(segment.id);
      toast({
        title: "Segment deleted",
        description: "The segment has been removed.",
      });
      onOpenChange(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete segment",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResetTitle = () => {
    if (linkedTask) {
      setTitle(linkedTask.title);
      setTitleIsCustom(false);
    }
  };

  if (!segment) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Time Segment</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Overlap Warning */}
          {segment && (
            <OverlapWarning
              segment={segment}
              allSegments={segments}
              onDismiss={() => {}}
            />
          )}

          {/* === TIER 1: CORE FIELDS === */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Segment title"
                />
                {titleIsCustom && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleResetTitle}
                    title="Reset to task title"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                )}
              </div>
              {titleIsCustom && (
                <p className="text-xs text-muted-foreground mt-1">
                  Custom title (not synced with task)
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Duration</Label>
                <Input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value) || 60)}
                  className="mt-1"
                  min={15}
                  step={15}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {Math.floor(duration / 60)}h {duration % 60}m
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startTime">Start Time</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="endTime">End Time</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={(v: any) => setStatus(v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planned">Planned</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* === TIER 2: STATUS (already shown above) === */}

          {/* === TIER 3: OPTIONAL (Advanced) === */}
          <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between">
                <span>Advanced Options</span>
                {showAdvanced ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-4">
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Rich text description"
                  className="mt-1"
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="notes">Session Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Session-specific notes"
                  className="mt-1"
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="color">Color</Label>
                <Input
                  id="color"
                  type="color"
                  value={color || "#3b82f6"}
                  onChange={(e) => setColor(e.target.value)}
                  className="mt-1 w-20 h-10"
                />
              </div>

              <div>
                <Label htmlFor="tags">Tags</Label>
                <Input
                  id="tags"
                  value={tags.join(", ")}
                  onChange={(e) =>
                    setTags(
                      e.target.value
                        .split(",")
                        .map((t) => t.trim())
                        .filter(Boolean)
                    )
                  }
                  placeholder="tag1, tag2, tag3"
                  className="mt-1"
                />
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* === Task Link Info (Read-only) === */}
          {linkedTask && (
            <div className="border-t pt-4">
              <div className="text-sm space-y-1">
                <div>
                  <span className="text-muted-foreground">Linked to:</span>{" "}
                  <strong>{linkedTask.title}</strong>
                </div>
                <div className="text-muted-foreground">
                  Session {segment.order} of{" "}
                  {useDailyGanttStore
                    .getState()
                    .getSegmentsForTask(segment.task_id).length}
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex justify-between">
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={loading}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Segment
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              Save Changes
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

