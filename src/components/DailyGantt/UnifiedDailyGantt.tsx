import React, { useEffect, useMemo, useState, useRef } from "react";
import { useDailyGanttStore } from "@/stores/dailyGanttStore";
import { useTaskStore } from "@/stores/taskStore";
import { DailyGanttHeader } from "./DailyGanttHeader";
import { UnifiedTaskListPanel } from "./UnifiedTaskListPanel";
import { UnifiedTimelinePanel } from "./UnifiedTimelinePanel";
import { BulkActionToolbar } from "./BulkActionToolbar";
import { ErrorBoundary } from "@/components/DailyGantt/ErrorBoundary";
import { TaskDialog } from "@/components/TaskDialog";
import { ResizablePanel, ResizablePanelGroup, ResizableHandle } from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import "./daily-gantt-styles.css";

export const UnifiedDailyGantt: React.FC = () => {
  const DEBUG_LOGS = false; // Flip to true for granular render/debug logging
  const {
    selectedDate,
    fetchSegmentsForDate,
    loading,
    expandedTaskIds,
    toggleTaskExpanded,
    reorderTasks,
    getGanttRows,
    segments, // Add segments to dependencies so useMemo updates when segments change
  } = useDailyGanttStore();
  const { fetchTasks } = useTaskStore();
  const [editingTask, setEditingTask] = useState<any>(null);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
  // Refs for synchronized scrolling
  const taskListScrollRef = useRef<HTMLDivElement>(null);
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        await fetchTasks();
        await fetchSegmentsForDate(selectedDate);
      } catch (error) {
        console.error('Error loading Daily Gantt data:', error);
      }
    };
    loadData();
  }, [selectedDate, fetchSegmentsForDate, fetchTasks]);

  // Calendar sync is now handled by store-level refresh mechanisms
  // No need for polling here - reduces unnecessary re-renders

  // Build 1:1 aligned rows using store method
  const ganttRows = useMemo(() => {
    try {
      const rows = getGanttRows(selectedDate);
      if (DEBUG_LOGS) {
        console.log('🔍 [UnifiedDailyGantt] Gantt Rows Debug:', {
          date: selectedDate,
          rowCount: rows.length,
          totalSegments: rows.reduce((sum, row) => sum + row.segments.length, 0),
          rowsWithSegments: rows.filter(r => r.segments.length > 0).length,
          firstRowWithSegments: rows.find(r => r.segments.length > 0) || null,
        });
        rows.forEach((row, idx) => {
          if (row.segments.length > 0) {
            console.log(`  Row ${idx}:`, {
              taskTitle: row.task?.title || 'No task',
              segmentCount: row.segments.length,
              segments: row.segments.map(s => ({
                id: s.id,
                start: s.start_time,
                end: s.end_time,
              })),
            });
          }
        });
      }
      return rows;
    } catch (error) {
      console.error('❌ Error building gantt rows:', error);
      return [];
    }
  }, [selectedDate, getGanttRows, segments]); // Add segments dependency so rows update when segments change optimistically

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[600px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="unified-daily-gantt h-full flex flex-col bg-background">
        {/* Header */}
        <DailyGanttHeader />

        {/* Main content - 1:1 aligned layout */}
        <div className="flex-1 overflow-hidden border-t border-border">
          <ResizablePanelGroup direction="horizontal" className="h-full">
            {/* Left: Task List (source of truth for order) */}
            {!isSidebarCollapsed ? (
              <>
                <ResizablePanel defaultSize={30} minSize={20} maxSize={50} className="border-r border-border relative">
                  <UnifiedTaskListPanel
                    ganttRows={ganttRows}
                    onTaskReorder={reorderTasks}
                    expandedTaskIds={expandedTaskIds}
                    onToggleExpand={toggleTaskExpanded}
                    onTaskEdit={(task) => {
                      // Get fresh task from global store to ensure we have latest data
                      const taskStore = useTaskStore.getState();
                      const freshTask = taskStore.tasks.find(t => t.id === task.id);
                      if (freshTask) {
                        setEditingTask(freshTask);
                      } else {
                        setEditingTask(task); // Fallback to passed task if not found in store
                      }
                      setTaskDialogOpen(true);
                    }}
                    scrollRef={taskListScrollRef}
                    syncScrollRef={timelineScrollRef}
                    isScrollingRef={isScrollingRef}
                    onCollapse={() => setIsSidebarCollapsed(true)}
                  />
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
                  title="Expand task list"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}

            {/* Right: Timeline (perfectly aligned rows) */}
            <ResizablePanel>
              <UnifiedTimelinePanel 
                ganttRows={ganttRows}
                scrollRef={timelineScrollRef}
                syncScrollRef={taskListScrollRef}
                isScrollingRef={isScrollingRef}
              />
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>

      {/* Bulk Action Toolbar */}
      <BulkActionToolbar />

      {/* Task Editor Dialog */}
      <TaskDialog
        open={taskDialogOpen}
        onOpenChange={(open) => {
          setTaskDialogOpen(open);
          if (!open) setEditingTask(null);
        }}
        onSuccess={async () => {
          // TaskDialog already refreshes taskStore internally
          // Refresh segments for current date to show updated schedule
          await fetchSegmentsForDate(selectedDate);
          setTaskDialogOpen(false);
          setEditingTask(null);
        }}
        editTask={editingTask}
      />
    </div>
    </ErrorBoundary>
  );
};

