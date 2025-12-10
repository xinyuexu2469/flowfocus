export type TaskBreakdownStep = {
  title: string;
  description?: string;
  estimatedMinutes: number;
};

export type TaskBreakdownResponse = {
  steps: TaskBreakdownStep[];
  notesForUser: string;
};

export type TaskBreakdownRequest = {
  taskTitle: string;
  baseDescription?: string;
  extraContext?: string;
};

