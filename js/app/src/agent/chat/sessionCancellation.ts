import type { AgentStore } from "@phoenix/store/agentStore";

export const DEFAULT_SESSION_CANCELLATION_GRACE_MS = 3_000;
export const SESSION_CANCELLATION_GRACE_MS =
  DEFAULT_SESSION_CANCELLATION_GRACE_MS;

/**
 * Checks whether a session's local cancellation grace period is currently active.
 *
 * During this grace period, busy-conflict errors (HTTP 409) and active turn locks
 * are ignored because they are likely artifacts of this client's own recently cancelled turn
 * rather than another client acquiring the lock.
 *
 * Expired markers are cleared so they cannot suppress genuine busy-elsewhere detection indefinitely.
 */
export function isSessionSelfCancellationGraceActive(
  store: AgentStore,
  sessionId: string,
  now?: number,
  graceMs?: number
): boolean;
export function isSessionSelfCancellationGraceActive(options: {
  store: AgentStore;
  sessionId: string;
  now?: number;
  graceMs?: number;
}): boolean;
export function isSessionSelfCancellationGraceActive(
  storeOrOptions:
    | AgentStore
    | {
        store: AgentStore;
        sessionId: string;
        now?: number;
        graceMs?: number;
      },
  maybeSessionId?: string,
  maybeNow: number = Date.now(),
  maybeGraceMs: number = DEFAULT_SESSION_CANCELLATION_GRACE_MS
): boolean {
  const store =
    "getState" in storeOrOptions ? storeOrOptions : storeOrOptions.store;
  const sessionId =
    "getState" in storeOrOptions
      ? (maybeSessionId as string)
      : storeOrOptions.sessionId;
  const now =
    "getState" in storeOrOptions
      ? maybeNow
      : (storeOrOptions.now ?? Date.now());
  const graceMs =
    "getState" in storeOrOptions
      ? maybeGraceMs
      : (storeOrOptions.graceMs ?? DEFAULT_SESSION_CANCELLATION_GRACE_MS);

  const cancelledAt =
    store.getState().locallyCancelledSessionAtBySessionId?.[sessionId];

  if (cancelledAt == null) {
    return false;
  }

  if (now - cancelledAt <= graceMs) {
    return true;
  }

  // Expired markers must not suppress real cross-client lock detection.
  store.getState().clearSessionLocallyCancelled(sessionId);
  return false;
}
