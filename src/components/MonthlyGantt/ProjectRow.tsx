import React, { useState } from "react";
import { Project } from "@/types/project";
import { useMonthlyGanttStore } from "@/stores/monthlyGanttStore";
import { GripVertical, Edit2, Trash2, Check, X } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ProjectForm } from "./ProjectForm";

interface ProjectRowProps {
  project: Project;
}

export const ProjectRow: React.FC<ProjectRowProps> = ({ project }) => {
  const { updateProject, deleteProject } = useMonthlyGanttStore();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(project.name);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: project.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleSave = async () => {
    if (editedName.trim() && editedName !== project.name) {
      await updateProject(project.id, { name: editedName.trim() });
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedName(project.name);
    setIsEditing(false);
  };

  const handleDelete = async () => {
    await deleteProject(project.id);
    setShowDeleteDialog(false);
  };

  const handleEditSubmit = async (formData: {
    name: string;
    start_date: string;
    deadline: string;
    priority: "urgent" | "high" | "medium" | "low";
    status: "not-started" | "in-progress" | "completed" | "on-hold";
    description: string;
  }) => {
    setIsLoading(true);
    try {
      await updateProject(project.id, {
        name: formData.name.trim(),
        start_date: formData.start_date,
        deadline: formData.deadline,
        priority: formData.priority,
        status: formData.status,
        description: formData.description || null,
      });

      toast({
        title: "Project updated",
        description: `"${formData.name}" has been updated.`,
      });

      setShowEditDialog(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update project",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getPriorityEmoji = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "🔴";
      case "high":
        return "🟡";
      case "medium":
        return "🔵";
      case "low":
        return "⚪";
      default:
        return "⚪";
    }
  };

  const startDate = parseISO(project.start_date);
  const deadline = parseISO(project.deadline);

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className="mb-2 border rounded-lg bg-card hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-start gap-2 p-3">
          {/* Drag handle */}
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing pt-1 text-muted-foreground hover:text-foreground"
          >
            <GripVertical className="w-4 h-4" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Project name */}
            {isEditing ? (
              <div className="flex items-center gap-2">
                <Input
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSave();
                    if (e.key === "Escape") handleCancel();
                  }}
                  autoFocus
                  className="h-8 text-sm"
                />
                <Button size="sm" variant="ghost" onClick={handleSave}>
                  <Check className="w-4 h-4 text-green-600" />
                </Button>
                <Button size="sm" variant="ghost" onClick={handleCancel}>
                  <X className="w-4 h-4 text-red-600" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm truncate">
                  {project.name}
                </span>
                <span className="text-sm">{getPriorityEmoji(project.priority)}</span>
              </div>
            )}

            {/* Date range */}
            <div className="text-xs text-muted-foreground mt-1">
              {format(startDate, "MMM d")} → {format(deadline, "MMM d")}
            </div>

            {/* Status badge */}
            {project.status === "completed" && (
              <div className="inline-flex items-center gap-1 mt-2 px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                <Check className="w-3 h-3" />
                Done
              </div>
            )}
          </div>

          {/* Actions */}
          {!isEditing && (
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowEditDialog(true)}
                className="h-7 w-7 p-0"
              >
                <Edit2 className="w-3 h-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowDeleteDialog(true)}
                className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{project.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
          </DialogHeader>

          <ProjectForm
            mode="edit"
            initialValues={{
              name: project.name,
              start_date: project.start_date,
              deadline: project.deadline,
              priority: project.priority,
              status: project.status,
              description: project.description || "",
            }}
            onSubmit={handleEditSubmit}
            onCancel={() => setShowEditDialog(false)}
            isLoading={isLoading}
          />
        </DialogContent>
      </Dialog>
    </>
  );
};

