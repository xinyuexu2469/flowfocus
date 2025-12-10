import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Project } from "@/types/project";
import { format } from "date-fns";

interface ProjectFormData {
  name: string;
  start_date: string;
  deadline: string;
  priority: "urgent" | "high" | "medium" | "low";
  status: "not-started" | "in-progress" | "completed" | "on-hold";
  description: string;
}

interface ProjectFormProps {
  mode: "create" | "edit";
  initialValues?: Partial<ProjectFormData>;
  onSubmit: (data: ProjectFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export const ProjectForm: React.FC<ProjectFormProps> = ({
  mode,
  initialValues,
  onSubmit,
  onCancel,
  isLoading = false,
}) => {
  const [formData, setFormData] = React.useState<ProjectFormData>({
    name: initialValues?.name || "",
    start_date: initialValues?.start_date || format(new Date(), "yyyy-MM-dd"),
    deadline: initialValues?.deadline || format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"),
    priority: initialValues?.priority || "medium",
    status: initialValues?.status || "not-started",
    description: initialValues?.description || "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      return;
    }

    await onSubmit({
      name: formData.name.trim(),
      start_date: formData.start_date,
      deadline: formData.deadline,
      priority: formData.priority,
      status: formData.status,
      description: formData.description || "",
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Project name */}
      <div>
        <Label htmlFor="name">Project Name *</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) =>
            setFormData({ ...formData, name: e.target.value })
          }
          placeholder="e.g., Research Paper"
          required
          disabled={isLoading}
        />
      </div>

      {/* Date range */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="start_date">Start Date</Label>
          <Input
            id="start_date"
            type="date"
            value={formData.start_date}
            onChange={(e) =>
              setFormData({ ...formData, start_date: e.target.value })
            }
            disabled={isLoading}
          />
        </div>

        <div>
          <Label htmlFor="deadline">Deadline</Label>
          <Input
            id="deadline"
            type="date"
            value={formData.deadline}
            onChange={(e) =>
              setFormData({ ...formData, deadline: e.target.value })
            }
            disabled={isLoading}
          />
        </div>
      </div>

      {/* Priority */}
      <div>
        <Label htmlFor="priority">Priority</Label>
        <Select
          value={formData.priority}
          onValueChange={(value: any) =>
            setFormData({ ...formData, priority: value })
          }
          disabled={isLoading}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="urgent">🔴 Urgent</SelectItem>
            <SelectItem value="high">🟡 High</SelectItem>
            <SelectItem value="medium">🔵 Medium</SelectItem>
            <SelectItem value="low">⚪ Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Status */}
      <div>
        <Label htmlFor="status">Status</Label>
        <Select
          value={formData.status}
          onValueChange={(value: any) =>
            setFormData({ ...formData, status: value })
          }
          disabled={isLoading}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="not-started">Not Started</SelectItem>
            <SelectItem value="in-progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="on-hold">On Hold</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Description (optional) */}
      <div>
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) =>
            setFormData({ ...formData, description: e.target.value })
          }
          rows={3}
          placeholder="Additional details about the project..."
          disabled={isLoading}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2 justify-end">
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {mode === "create" ? "Create Project" : "Update Project"}
        </Button>
      </div>
    </form>
  );
};

