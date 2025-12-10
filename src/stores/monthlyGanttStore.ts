import { create } from 'zustand';
import { getApiClient } from '@/lib/clerk-api';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { Project } from '@/types/project';

interface MonthlyGanttStore {
  // View state
  selectedMonth: Date;
  
  // Data
  projects: Project[];
  
  // UI state
  editingProjectId: string | null;
  
  // Loading
  loading: boolean;
  error: string | null;
  
  // Actions
  setSelectedMonth: (date: Date) => void;
  fetchProjects: () => Promise<void>;
  
  // Project CRUD
  createProject: (project: Omit<Project, 'id' | 'user_id' | 'order' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  
  // Reordering
  reorderProjects: (sourceIndex: number, destinationIndex: number) => Promise<void>;
  
  // Project bar interactions
  moveProjectBar: (id: string, newStartDate: Date) => Promise<void>;
  resizeProjectBar: (id: string, newStartDate: Date, newDeadline: Date) => Promise<void>;
  
  // Computed
  getSortedProjects: () => Project[];
  getProjectsForMonth: (month: Date) => Project[];
}

export const useMonthlyGanttStore = create<MonthlyGanttStore>((set, get) => ({
  selectedMonth: new Date(),
  projects: [],
  editingProjectId: null,
  loading: false,
  error: null,
  
  setSelectedMonth: (date) => {
    set({ selectedMonth: date });
  },
  
  fetchProjects: async () => {
    set({ loading: true, error: null });
    try {
      const api = getApiClient();
      const data = await api.projects.getAll() as Project[];
      // Sort by order
      const sorted = data.sort((a, b) => (a.order || 0) - (b.order || 0));
      set({ projects: sorted, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },
  
  createProject: async (projectData) => {
    try {
      const api = getApiClient();

      // Get max order + 1 (add to bottom)
      const maxOrder = Math.max(...get().projects.map(p => p.order || 0), -1);
      
      const newProject = await api.projects.create({
        ...projectData,
        order: maxOrder + 1,
      }) as Project;

      set(state => ({
        projects: [...state.projects, newProject]
      }));
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },
  
  updateProject: async (id, updates) => {
    try {
      const project = get().projects.find(p => p.id === id);
      if (!project) {
        throw new Error(`Project ${id} not found`);
      }

      // OPTIMISTIC UPDATE: Update store immediately
      const optimisticUpdated: Project = {
        ...project,
        ...updates,
        updated_at: new Date().toISOString(),
      };

      set(state => ({
        projects: state.projects.map(p => p.id === id ? optimisticUpdated : p)
      }));

      // Fire API call in background
      const api = getApiClient();
      const updated = await api.projects.update(id, updates) as Project;

      // Update with server response (should match optimistic, but ensures consistency)
      set(state => ({
        projects: state.projects.map(p => p.id === id ? updated : p)
      }));
    } catch (error: any) {
      // On error, revert by re-fetching
      get().fetchProjects();
      set({ error: error.message });
      throw error;
    }
  },
  
  deleteProject: async (id) => {
    try {
      const api = getApiClient();
      await api.projects.delete(id);

      set(state => ({
        projects: state.projects.filter(p => p.id !== id)
      }));
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },
  
  reorderProjects: async (sourceIndex, destinationIndex) => {
    const { projects } = get();
    
    // Create new array with reordered projects
    const reordered = Array.from(projects);
    const [removed] = reordered.splice(sourceIndex, 1);
    reordered.splice(destinationIndex, 0, removed);
    
    // Update order values
    const updated = reordered.map((project, index) => ({
      ...project,
      order: index
    }));
    
    // Optimistic update
    set({ projects: updated });
    
    // Persist to backend
    try {
      const api = getApiClient();
      // Update all projects' order
      await Promise.all(
        updated.map((project, index) =>
          api.projects.update(project.id, { order: index })
        )
      );
    } catch (error: any) {
      console.error('Failed to update project order:', error);
      // Revert on error
      set({ projects });
    }
  },
  
  moveProjectBar: async (id, newStartDate) => {
    const project = get().projects.find(p => p.id === id);
    if (!project) return;
    
    // Calculate duration and adjust deadline
    const startDate = parseISO(project.start_date);
    const deadline = parseISO(project.deadline);
    const duration = deadline.getTime() - startDate.getTime();
    const newDeadline = new Date(newStartDate.getTime() + duration);
    
    await get().updateProject(id, {
      start_date: format(newStartDate, 'yyyy-MM-dd'),
      deadline: format(newDeadline, 'yyyy-MM-dd'),
    });
  },
  
  resizeProjectBar: async (id, newStartDate, newDeadline) => {
    await get().updateProject(id, {
      start_date: format(newStartDate, 'yyyy-MM-dd'),
      deadline: format(newDeadline, 'yyyy-MM-dd'),
    });
  },
  
  getSortedProjects: () => {
    return get().projects.sort((a, b) => a.order - b.order);
  },
  
  getProjectsForMonth: (month) => {
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    
    return get().projects.filter(project => {
      const startDate = parseISO(project.start_date);
      const deadline = parseISO(project.deadline);
      return startDate <= monthEnd && deadline >= monthStart;
    }).sort((a, b) => a.order - b.order);
  },
}));
