// Shared utilities for session data normalization

export type SessionStatus = 'completed' | 'in_progress' | 'demo' | 'processing' | 'active' | 'analyzed' | 'archived';

/**
 * Normalizes session status from database to UI display
 * @param dbStatus - The status from the database
 * @param hasAnalysis - Whether the session has analysis data
 * @returns Normalized status for UI display
 */
export function normalizeSessionStatus(dbStatus: string, hasAnalysis?: boolean): SessionStatus {
  // Map database statuses to UI statuses
  switch (dbStatus) {
    case 'analyzed':
      return 'completed'; // Show as completed in UI
    case 'completed':
      return hasAnalysis ? 'completed' : 'processing';
    case 'active':
      return 'in_progress';
    case 'processing':
      return 'processing';
    case 'demo':
      return 'demo';
    case 'archived':
      return 'archived' as SessionStatus;
    default:
      return 'in_progress';
  }
}

/**
 * Maps dates from snake_case to camelCase
 * @param data - The data object with potential snake_case date fields
 * @returns Object with camelCase date fields
 */
export function normalizeDates(data: any) {
  return {
    createdAt: data.createdAt || data.created_at || new Date().toISOString(),
    endedAt: data.endedAt || data.ended_at || null,
    analyzedAt: data.analyzedAt || data.analyzed_at || null,
    updatedAt: data.updatedAt || data.updated_at || null,
    startedAt: data.startedAt || data.started_at || null
  };
}

/**
 * Normalizes score to a consistent scale
 * @param score - The score value
 * @param fromScale - The scale the score is currently in (10 or 100)
 * @param toScale - The scale to convert to (10 or 100)
 * @returns Normalized score
 */
export function normalizeScore(score: number | undefined, fromScale: 10 | 100, toScale: 10 | 100): number {
  if (!score && score !== 0) return 0;

  if (fromScale === toScale) {
    return score;
  }

  if (fromScale === 10 && toScale === 100) {
    return score * 10;
  }

  if (fromScale === 100 && toScale === 10) {
    return score / 10;
  }

  return score;
}

/**
 * Checks if a session is a demo session
 * @param sessionId - The session ID to check
 * @param status - The session status
 * @returns Whether the session is a demo
 */
export function isDemoSession(sessionId?: string, status?: string): boolean {
  if (status === 'demo') return true;
  if (sessionId?.startsWith('demo-')) return true;
  if (sessionId?.startsWith('temp-')) return true;
  if (sessionId?.includes('demo')) return true;
  return false;
}