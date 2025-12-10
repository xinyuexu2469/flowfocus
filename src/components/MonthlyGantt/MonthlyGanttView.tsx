import React, { useEffect, useState } from "react";
import { useMonthlyGanttStore } from "@/stores/monthlyGanttStore";
import { MonthlyGanttHeader } from "./MonthlyGanttHeader";
import { ProjectListPanel } from "./ProjectListPanel";
import { ProjectTimelinePanel } from "./ProjectTimelinePanel";
import { ResizablePanel, ResizablePanelGroup, ResizableHandle } from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const MonthlyGanttView: React.FC = () => {
  const { fetchProjects, loading } = useMonthlyGanttStore();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[600px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="monthly-gantt-view h-full flex flex-col bg-background">
      {/* Header */}
      <MonthlyGanttHeader />

      {/* Main content */}
      <div className="flex-1 overflow-hidden border-t border-border">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* Left: Project List (user-curated) */}
          {!isSidebarCollapsed ? (
            <>
              <ResizablePanel defaultSize={30} minSize={20} maxSize={50} className="border-r border-border">
                <ProjectListPanel onCollapse={() => setIsSidebarCollapsed(true)} />
              </ResizablePanel>
              <ResizableHandle className="w-1 bg-border hover:bg-primary/20 transition-colors" />
            </>
          ) : (
            // Collapsed state: Show thin strip with expand button
            <div className="w-12 border-r border-border bg-card flex flex-col items-center py-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsSidebarCollapsed(false)}
                className="h-8 w-8"
                title="Expand project list"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* Right: Project Timeline */}
          <ResizablePanel>
            <ProjectTimelinePanel />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
};

