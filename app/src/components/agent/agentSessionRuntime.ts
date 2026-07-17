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

/**
 * Resolves the Relay identity without replacing the browser client key used by
 * the chat runtime. Newly-created sessions intentionally use different values.
 */
export function getPersistedAgentSessionId({
  cachedSessionId,
  listedSessionId,
}: {
  cachedSessionId: string | null | undefined;
  listedSessionId: string | null | undefined;
}): string | null {
  return cachedSessionId ?? listedSessionId ?? null;
}
