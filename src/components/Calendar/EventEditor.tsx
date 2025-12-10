import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link, Unlink, Plus } from "lucide-react";
import { format } from "date-fns";
import { useTaskStore } from "@/stores/taskStore";

interface EventEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: {
    id?: string;
    title?: string;
    description?: string;
    startTime?: Date;
    endTime?: Date;
    allDay?: boolean;
    taskId?: string;
    location?: string;
  } | null;
  onSave: (data: any) => Promise<void>;
  onDelete?: () => Promise<void>;
}

export const EventEditor: React.FC<EventEditorProps> = ({
  open,
  onOpenChange,
  event,
  onSave,
  onDelete,
}) => {
  const { tasks } = useTaskStore();
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    startTime: new Date(),
    endTime: new Date(),
    allDay: false,
    taskId: "",
    location: "",
  });

  const [linkMode, setLinkMode] = useState<"none" | "existing" | "new">("none");

  useEffect(() => {
    if (event) {
      setFormData({
        title: event.title || "",
        description: event.description || "",
        startTime: event.startTime || new Date(),
        endTime: event.endTime || new Date(),
        allDay: event.allDay || false,
        taskId: event.taskId || "",
        location: event.location || "",
      });
      setLinkMode(event.taskId ? "existing" : "none");
    } else {
      setFormData({
        title: "",
        description: "",
        startTime: new Date(),
        endTime: new Date(Date.now() + 3600000),
        allDay: false,
        taskId: "",
        location: "",
      });
      setLinkMode("none");
    }
  }, [event, open]);

  const formatDateTimeLocal = (date: Date) => {
    const d = new Date(date);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const dataToSave = {
      ...formData,
      taskId: linkMode === "none" ? null : formData.taskId || null,
    };

    await onSave(dataToSave);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{event?.id ? "Edit Event" : "Create Event"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              required
            />
          </div>

          {/* Date/Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Start</Label>
              <Input
                type="datetime-local"
                value={formatDateTimeLocal(formData.startTime)}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    startTime: new Date(e.target.value),
                  })
                }
              />
            </div>

            <div>
              <Label>End</Label>
              <Input
                type="datetime-local"
                value={formatDateTimeLocal(formData.endTime)}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    endTime: new Date(e.target.value),
                  })
                }
              />
            </div>
          </div>

          {/* All day */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="allDay"
              checked={formData.allDay}
              onChange={(e) =>
                setFormData({ ...formData, allDay: e.target.checked })
              }
              className="rounded"
            />
            <Label htmlFor="allDay" className="cursor-pointer">
              All day event
            </Label>
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              rows={3}
            />
          </div>

          {/* Task linking */}
          <div className="border-t pt-4">
            <Label className="mb-2 block">Link to Task</Label>

            <div className="space-y-2">
              {/* Link mode selector */}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={linkMode === "none" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setLinkMode("none")}
                >
                  <Unlink className="w-4 h-4 mr-2" />
                  No Link
                </Button>

                <Button
                  type="button"
                  variant={linkMode === "existing" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setLinkMode("existing")}
                >
                  <Link className="w-4 h-4 mr-2" />
                  Link Existing
                </Button>

                <Button
                  type="button"
                  variant={linkMode === "new" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setLinkMode("new")}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create New
                </Button>
              </div>

              {/* Task selector (if linking to existing) */}
              {linkMode === "existing" && (
                <Select
                  value={formData.taskId}
                  onValueChange={(value) =>
                    setFormData({ ...formData, taskId: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a task..." />
                  </SelectTrigger>
                  <SelectContent>
                    {tasks
                      .filter((t) => !t.parent_task_id)
                      .map((task) => (
                        <SelectItem key={task.id} value={task.id}>
                          {task.title}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              )}

              {/* Info for new task mode */}
              {linkMode === "new" && (
                <div className="text-sm text-muted-foreground bg-muted border rounded p-3">
                  A new task will be created with:
                  <ul className="list-disc list-inside mt-2">
                    <li>Title: {formData.title || "(event title)"}</li>
                    <li>
                      Due date:{" "}
                      {format(formData.endTime, "MMM d, yyyy")}
                    </li>
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Location */}
          <div>
            <Label htmlFor="location">Location (optional)</Label>
            <Input
              id="location"
              value={formData.location}
              onChange={(e) =>
                setFormData({ ...formData, location: e.target.value })
              }
              placeholder="e.g., Library, Room 101"
            />
          </div>

          {/* Actions */}
          <DialogFooter className="gap-2">
            {onDelete && event?.id && (
              <Button type="button" variant="destructive" onClick={onDelete}>
                Delete
              </Button>
            )}

            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">{event?.id ? "Save" : "Create"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

