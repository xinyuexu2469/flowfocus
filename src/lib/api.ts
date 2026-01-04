// API client for backend server
// Uses Clerk for authentication

import { getClerkTokenGetter } from './clerk-api';

function normalizeApiBaseUrl(raw: string) {
  let value = raw.trim();
  // Allow configuring either the backend origin (e.g. https://api.example.com)
  // or the full API base path (e.g. https://api.example.com/api or /api)
  if (!/\/api\/?$/.test(value)) {
    value = `${value.replace(/\/+$/, '')}/api`;
  }
  return value.replace(/\/+$/, '');
}

const CONFIGURED_API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_BACKEND_URL;

// In development, always use same-origin `/api` so the Vite dev server proxy
// can forward requests to the local backend (works in Codespaces/devcontainers).
export const API_BASE_URL = import.meta.env.DEV
  ? '/api'
  : normalizeApiBaseUrl(CONFIGURED_API_BASE_URL || 'http://localhost:4000');

// Helper function to make API requests with Clerk token
async function apiRequest(
  endpoint: string, 
  getToken: (() => Promise<string | null>) | null,
  options: RequestInit = {}
) {
  let token: string | null = null;
  
  if (getToken) {
    try {
      token = await getToken();
    } catch (error) {
      // In development, continue without token if Clerk is not available
      console.warn('Could not get Clerk token:', error);
    }
  }
  
  // Development mode: Allow requests without token (backend will use test user)
  const isDevMode = import.meta.env.DEV;
  if (!token && !isDevMode) {
    throw new Error('User not authenticated. Please sign in.');
  }

  const url = `${API_BASE_URL}${endpoint}`;
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  // Only add Authorization header if we have a token
  // In dev mode without token, backend will automatically create/use test user
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// Factory function to create API clients with Clerk token getter
export function createApiClient(getToken: () => Promise<string | null>) {
  return {
    // Tasks API
    tasks: {
      getAll: () => apiRequest('/tasks', getToken),
      
      getByDate: (date: string) => apiRequest(`/tasks/by-date?date=${date}`, getToken),
      
      getById: (id: string) => apiRequest(`/tasks/${id}`, getToken),
      
      create: (task: any) => apiRequest('/tasks', getToken, {
        method: 'POST',
        body: JSON.stringify(task),
      }),
      
      update: (id: string, updates: any) => apiRequest(`/tasks/${id}`, getToken, {
        method: 'PUT',
        body: JSON.stringify(updates),
      }),
      
      delete: (id: string) => apiRequest(`/tasks/${id}`, getToken, {
        method: 'DELETE',
      }),
      
      getSubtasks: (parentId: string) => apiRequest(`/tasks/${parentId}/subtasks`, getToken),
    },

    // Time Segments API
    timeSegments: {
      getAll: (date?: string) => {
        const endpoint = date ? `/time-segments?date=${date}` : '/time-segments';
        return apiRequest(endpoint, getToken);
      },
      
      getByDate: (date: string) => apiRequest(`/time-segments/by-date/${date}`, getToken),
      
      create: (segment: any) => apiRequest('/time-segments', getToken, {
        method: 'POST',
        body: JSON.stringify(segment),
      }),
      
      update: (id: string, updates: any) => apiRequest(`/time-segments/${id}`, getToken, {
        method: 'PUT',
        body: JSON.stringify(updates),
      }),
      
      delete: (id: string) => apiRequest(`/time-segments/${id}`, getToken, {
        method: 'DELETE',
      }),
      
      bulkDelete: (ids: string[]) => apiRequest('/time-segments/bulk-delete', getToken, {
        method: 'POST',
        body: JSON.stringify({ ids }),
      }),
      
      bulkUpdate: (updates: { id: string; [key: string]: any }[]) => apiRequest('/time-segments/bulk-update', getToken, {
        method: 'POST',
        body: JSON.stringify({ updates }),
      }),
    },

    // Projects API
    projects: {
      getAll: () => apiRequest('/projects', getToken),
      
      create: (project: any) => apiRequest('/projects', getToken, {
        method: 'POST',
        body: JSON.stringify(project),
      }),
      
      update: (id: string, updates: any) => apiRequest(`/projects/${id}`, getToken, {
        method: 'PUT',
        body: JSON.stringify(updates),
      }),
      
      delete: (id: string) => apiRequest(`/projects/${id}`, getToken, {
        method: 'DELETE',
      }),
    },

    // Goals API
    goals: {
      getAll: () => apiRequest('/goals', getToken),
      
      create: (goal: any) => apiRequest('/goals', getToken, {
        method: 'POST',
        body: JSON.stringify(goal),
      }),
      
      update: (id: string, updates: any) => apiRequest(`/goals/${id}`, getToken, {
        method: 'PUT',
        body: JSON.stringify(updates),
      }),
      
      delete: (id: string) => apiRequest(`/goals/${id}`, getToken, {
        method: 'DELETE',
      }),
    },

    // Google Calendar API
    googleCalendar: {
      getAuthUrl: () => apiRequest('/google-calendar/auth/url', getToken),
      
      getStatus: () => apiRequest('/google-calendar/auth/status', getToken),
      
      handleCallback: (code: string) => apiRequest('/google-calendar/auth/callback', getToken, {
        method: 'POST',
        body: JSON.stringify({ code }),
      }),
      
      disconnect: () => apiRequest('/google-calendar/auth/disconnect', getToken, {
        method: 'POST',
      }),
      
      sync: () => apiRequest('/google-calendar/sync', getToken, {
        method: 'POST',
      }),
      
      getSyncStatus: () => apiRequest('/google-calendar/sync/status', getToken),
    },
  };
}

// Health check (no auth required)
export const healthApi = {
  check: () => fetch(`${API_BASE_URL}/health`).then(res => res.json()),
};

// Export type for API client
export type ApiClient = ReturnType<typeof createApiClient>;

// Convenience exports for direct use in components
// These use the global token getter from clerk-api.ts

// Helper to get API client using global token getter
// Note: This is a different function from clerk-api.ts's getApiClient
// This one is used internally by the convenience exports
function getApiClientInstance() {
  const getToken = getClerkTokenGetter();
  if (!getToken) {
    throw new Error('Clerk token getter not initialized. Make sure ClerkProvider is set up.');
  }
  return createApiClient(getToken);
}

// Lazy getter functions that return API methods
// These will throw if Clerk is not initialized
// Using function wrappers to ensure proper initialization
export const tasksApi = {
  getAll: async () => {
    const client = getApiClientInstance();
    return client.tasks.getAll();
  },
  getByDate: async (date: string) => {
    const client = getApiClientInstance();
    return client.tasks.getByDate(date);
  },
  getById: async (id: string) => {
    const client = getApiClientInstance();
    return client.tasks.getById(id);
  },
  create: async (task: any) => {
    const client = getApiClientInstance();
    return client.tasks.create(task);
  },
  update: async (id: string, updates: any) => {
    const client = getApiClientInstance();
    return client.tasks.update(id, updates);
  },
  delete: async (id: string) => {
    const client = getApiClientInstance();
    return client.tasks.delete(id);
  },
  getSubtasks: async (parentId: string) => {
    const client = getApiClientInstance();
    return client.tasks.getSubtasks(parentId);
  },
};

export const timeSegmentsApi = {
  getAll: async (date?: string) => {
    const client = getApiClientInstance();
    return client.timeSegments.getAll(date);
  },
  getByDate: async (date: string) => {
    const client = getApiClientInstance();
    return client.timeSegments.getByDate(date);
  },
  create: async (segment: any) => {
    const client = getApiClientInstance();
    return client.timeSegments.create(segment);
  },
  update: async (id: string, updates: any) => {
    const client = getApiClientInstance();
    return client.timeSegments.update(id, updates);
  },
  delete: async (id: string) => {
    const client = getApiClientInstance();
    return client.timeSegments.delete(id);
  },
};

export const goalsApi = {
  getAll: async () => {
    const client = getApiClientInstance();
    return client.goals.getAll();
  },
  create: async (goal: any) => {
    const client = getApiClientInstance();
    return client.goals.create(goal);
  },
  update: async (id: string, updates: any) => {
    const client = getApiClientInstance();
    return client.goals.update(id, updates);
  },
  delete: async (id: string) => {
    const client = getApiClientInstance();
    return client.goals.delete(id);
  },
};
