import React from "react";
// import { useDroppable } from "@dnd-kit/core"; // DISABLED: Sidebar drag-to-calendar feature

// DISABLED: Sidebar drag-to-calendar feature to prevent page freeze
const ENABLE_SIDEBAR_DRAG_CREATE = false;

interface CalendarDropZoneProps {
  children: React.ReactNode;
}

export const CalendarDropZone: React.FC<CalendarDropZoneProps> = ({ children }) => {
  // DISABLED: Sidebar drag-to-calendar feature
  // const { setNodeRef, isOver } = useDroppable({
  //   id: "calendar-drop-zone",
  //   data: {
  //     accepts: ["task"],
  //   },
  // });
  
  // Placeholder values when drag is disabled
  const setNodeRef = () => {};
  const isOver = false;

  return (
    <div
      ref={setNodeRef}
      className={`h-full ${ENABLE_SIDEBAR_DRAG_CREATE && isOver ? "bg-blue-50/50 border-2 border-blue-400" : ""}`}
      style={{ pointerEvents: 'auto' }}
    >
      {children}
    </div>
  );
};

