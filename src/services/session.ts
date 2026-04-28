/**
 * Session manager for stateful features like voice call sessions.
 * Tracks active modes that modify bot behavior.
 */

export interface CallSession {
    active: boolean;
    startedAt: number;
    durationMs: number;
    topic?: string;
    errorsCollected: string[];  // Grammar errors batched during call
}

let callSession: CallSession = {
    active: false,
    startedAt: 0,
    durationMs: 5 * 60 * 1000, // Default 5 minutes
    errorsCollected: [],
};

export function startCallSession(durationMinutes: number = 5, topic?: string): CallSession {
    callSession = {
        active: true,
        startedAt: Date.now(),
        durationMs: durationMinutes * 60 * 1000,
        topic,
        errorsCollected: [],
    };
    return callSession;
}

export function endCallSession(): { duration: number; errors: string[] } {
    const elapsed = Date.now() - callSession.startedAt;
    const errors = [...callSession.errorsCollected];
    callSession = {
        active: false,
        startedAt: 0,
        durationMs: 0,
        errorsCollected: [],
    };
    return { duration: elapsed, errors };
}

export function getCallSession(): CallSession {
    // Auto-expire if time is up
    if (callSession.active && Date.now() - callSession.startedAt > callSession.durationMs) {
        callSession.active = false;
    }
    return callSession;
}

export function addCallError(error: string): void {
    callSession.errorsCollected.push(error);
}

export function isInCallSession(): boolean {
    return getCallSession().active;
}

export function getCallTimeRemaining(): number {
    if (!callSession.active) return 0;
    const remaining = callSession.durationMs - (Date.now() - callSession.startedAt);
    return Math.max(0, remaining);
}
