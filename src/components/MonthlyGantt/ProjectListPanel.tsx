import React from "react";
import { DndContext, closestCenter, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useMonthlyGanttStore } from "@/stores/monthlyGanttStore";
import { ProjectRow } from "./ProjectRow";
import { AddProjectButton } from "./AddProjectButton";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";

interface ProjectListPanelProps {
  onCollapse?: () => void;
}

export const ProjectListPanel: React.FC<ProjectListPanelProps> = ({ onCollapse }) => {
  const { getSortedProjects, reorderProjects } = useMonthlyGanttStore();
  const projects = getSortedProjects();

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id) return;

    const sourceIndex = projects.findIndex((p) => p.id === active.id);
    const destinationIndex = projects.findIndex((p) => p.id === over.id);

    if (sourceIndex === -1 || destinationIndex === -1) return;

    reorderProjects(sourceIndex, destinationIndex);
  };

  return (
    <div className="project-list-panel h-full bg-card border-r overflow-y-auto flex flex-col">
      {/* Header */}
      <div className="sticky top-0 bg-card border-b px-4 py-3 font-medium text-sm z-10 flex items-center justify-between">
        <span>Projects</span>
        {onCollapse && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onCollapse}
            className="h-8 w-8"
            title="Collapse project list"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Draggable project list */}
      <div className="flex-1 overflow-y-auto p-2">
        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={projects.map((p) => p.id)}
            strategy={verticalListSortingStrategy}
          >
            {projects.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-8">
                No projects yet. Click "Add Project" to create one.
              </div>
            ) : (
              projects.map((project) => (
                <ProjectRow key={project.id} project={project} />
              ))
            )}
          </SortableContext>
        </DndContext>
      </div>

      {/* Add project button */}
      <div className="p-4 border-t">
        <AddProjectButton />
      </div>
    </div>
  );
};

