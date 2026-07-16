/**
 * Returns whether an active session needs its persisted transcript loaded.
 * An undefined ID represents a server-listed session not yet cached locally;
 * null represents a new browser-only session with no transcript to load.
 */
export function shouldHydrateAgentSession({
  hasRuntime,
  persistedSessionId,
}: {
  hasRuntime: boolean;
  persistedSessionId: string | null | undefined;
}): boolean {
  return !hasRuntime && persistedSessionId !== null;
}
