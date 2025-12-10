import React from "react";
import { Button } from "@/components/ui/button";
import { useDailyGanttStore } from "@/stores/dailyGanttStore";
import { Trash2, Move, Edit, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export const BulkActionToolbar: React.FC = () => {
  const {
    selectedSegmentIds,
    clearSegmentSelection,
    bulkDeleteSegments,
    bulkUpdateSegments,
  } = useDailyGanttStore();
  const { toast } = useToast();

  const selectedCount = selectedSegmentIds.size;

  if (selectedCount === 0) return null;

  const handleDelete = async () => {
    if (!confirm(`Delete ${selectedCount} selected segment(s)?`)) return;

    try {
      await bulkDeleteSegments(Array.from(selectedSegmentIds));
      toast({
        title: "Segments deleted",
        description: `${selectedCount} segment(s) have been removed.`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete segments",
      });
    }
  };

  const handleChangeStatus = async (status: "planned" | "in-progress" | "completed") => {
    try {
      await bulkUpdateSegments(Array.from(selectedSegmentIds), { status });
      toast({
        title: "Status updated",
        description: `${selectedCount} segment(s) marked as ${status}.`,
      });
      clearSegmentSelection();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update segments",
      });
    }
  };

  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 bg-card border border-border rounded-lg shadow-lg p-3 flex items-center gap-3">
      <div className="text-sm font-medium">
        {selectedCount} selected
      </div>

      <div className="h-6 w-px bg-border" />

      <Button
        variant="outline"
        size="sm"
        onClick={() => handleChangeStatus("planned")}
      >
        Mark Planned
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleChangeStatus("in-progress")}
      >
        Mark In Progress
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleChangeStatus("completed")}
      >
        Mark Completed
      </Button>

      <div className="h-6 w-px bg-border" />

      <Button
        variant="destructive"
        size="sm"
        onClick={handleDelete}
      >
        <Trash2 className="w-4 h-4 mr-2" />
        Delete All
      </Button>

      <Button
        variant="ghost"
        size="icon"
        onClick={clearSegmentSelection}
        title="Deselect all"
      >
        <X className="w-4 h-4" />
      </Button>
    </div>
  );
};

