import React, { useState } from "react";
import { useMonthlyGanttStore } from "@/stores/monthlyGanttStore";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ProjectForm } from "./ProjectForm";

export const AddProjectButton: React.FC = () => {
  const { createProject } = useMonthlyGanttStore();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (formData: {
    name: string;
    start_date: string;
    deadline: string;
    priority: "urgent" | "high" | "medium" | "low";
    status: "not-started" | "in-progress" | "completed" | "on-hold";
    description: string;
  }) => {
    if (!formData.name.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Project name is required",
      });
      return;
    }

    setIsLoading(true);
    try {
      await createProject({
        name: formData.name.trim(),
        start_date: formData.start_date,
        deadline: formData.deadline,
        priority: formData.priority,
        status: formData.status,
        description: formData.description || null,
        tags: null,
        notes: null,
        color: null,
        progress: null,
      });

      toast({
        title: "Project created",
        description: `"${formData.name}" has been added to your projects.`,
      });

      setIsOpen(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create project",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        variant="outline"
        className="w-full gap-2"
      >
        <Plus className="w-4 h-4" />
        Add Project
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
          </DialogHeader>

          <ProjectForm
            mode="create"
            onSubmit={handleSubmit}
            onCancel={() => setIsOpen(false)}
            isLoading={isLoading}
          />
        </DialogContent>
      </Dialog>
    </>
  );
};

