// Helper to get current user ID from Clerk
// This is a placeholder - actual implementation will use Clerk's useAuth hook
// For API calls, we'll get the token from Clerk and send it in the Authorization header

export function getCurrentUserId(): string | null {
  // This function is deprecated - use Clerk's useAuth hook instead
  // Keeping for backward compatibility during migration
  return null;
}

export function setCurrentUserId(userId: string | null) {
  // Deprecated - Clerk manages user state
  // No-op for backward compatibility
}

