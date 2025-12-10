// Global Clerk token getter for use in Zustand stores
// This allows stores to access Clerk tokens without being React components

import { createApiClient } from './api';

let globalGetToken: (() => Promise<string | null>) | null = null;

export function setClerkTokenGetter(getToken: () => Promise<string | null>) {
  globalGetToken = getToken;
}

export function getClerkTokenGetter(): (() => Promise<string | null>) | null {
  return globalGetToken;
}

// Create API client using global token getter
export function getApiClient() {
  const getToken = getClerkTokenGetter();
  if (!getToken) {
    throw new Error('Clerk token getter not initialized. Make sure ClerkProvider is set up.');
  }
  return createApiClient(getToken);
}

