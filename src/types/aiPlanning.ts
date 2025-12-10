export type PlanningWorkTimeBlock = {
  date: string;      // "2025-12-04"
  startTime: string; // "13:00"
  endTime: string;   // "14:00"
};

export type PlanningTask = {
  title: string;
  description?: string;
  priority: "high" | "medium" | "low";
  status: "todo" | "in_progress" | "done";
  estimatedMinutes: number;
  deadline?: string; // ISO date
  linkToGoalId?: string | null;
  workTimeBlocks: PlanningWorkTimeBlock[];
};

export type PlanningResponse = {
  summary: string;
  notesForUser: string;
  tasks: PlanningTask[];
};

export type PlanningRequestMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type PlanningRequest = {
  messages: PlanningRequestMessage[];
};

