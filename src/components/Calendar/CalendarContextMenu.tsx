import React from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Copy, Trash2, Edit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCalendarStore } from "@/stores/calendarStore";
import { format, addDays } from "date-fns";

interface CalendarContextMenuProps {
  event: {
    id: string;
    title: string;
    startTime: Date;
    endTime: Date;
    description?: string;
    taskId?: string;
    location?: string;
  };
  children: React.ReactNode;
  onEdit?: () => void;
}

export const CalendarContextMenu: React.FC<CalendarContextMenuProps> = ({
  event,
  children,
  onEdit,
}) => {
  const { deleteEvent, createEvent, fetchEvents } = useCalendarStore();
  const { toast } = useToast();

  const handleDelete = async () => {
    if (!confirm(`Delete "${event.title}"?`)) return;

    try {
      await deleteEvent(event.id);
      
      // Refresh events
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 2, 0);
      await fetchEvents(start, end);

      toast({
        title: "Event deleted",
        description: "The event has been removed from your calendar.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete event",
      });
    }
  };

  const handleDuplicate = async () => {
    try {
      const duration = event.endTime.getTime() - event.startTime.getTime();
      const newStartTime = addDays(event.startTime, 1); // Duplicate to next day
      const newEndTime = new Date(newStartTime.getTime() + duration);

      await createEvent({
        title: `${event.title} (Copy)`,
        description: event.description,
        startTime: newStartTime,
        endTime: newEndTime,
        allDay: false,
        taskId: event.taskId,
        location: event.location,
        source: "app",
      });

      // Refresh events
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 2, 0);
      await fetchEvents(start, end);

      toast({
        title: "Event duplicated",
        description: "A copy has been created for tomorrow.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to duplicate event",
      });
    }
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={onEdit}>
          <Edit className="w-4 h-4 mr-2" />
          Edit Event
        </ContextMenuItem>
        
        <ContextMenuSeparator />
        
        <ContextMenuItem onClick={handleDuplicate}>
          <Copy className="w-4 h-4 mr-2" />
          Duplicate
        </ContextMenuItem>
        
        <ContextMenuSeparator />
        
        <ContextMenuItem
          onClick={handleDelete}
          className="text-red-600 focus:text-red-600"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};

