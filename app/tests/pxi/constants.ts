export const DEFAULT_ASSISTANT_PROVIDER = "OPENAI";
export const DEFAULT_ASSISTANT_MODEL = "gpt-5.4";
export const DEFAULT_ASSISTANT_PROJECT_NAME = "assistant_agent";
export const DEFAULT_JUDGE_MODEL = "openai/gpt-4.1";

/**
 * Capability snapshot seeded into persisted PXI state by the Playwright
 * fixtures. This is intentionally a flat `Record<string, boolean>` that mirrors
 * the on-disk `capabilities` blob shape rather than importing the app's
 * `AgentCapabilities` type, so specs can seed *stale* state that omits keys a
 * newer Phoenix build would write (TypeScript would otherwise reject a partial
 * literal). Keep this aligned with the app's capability catalog in
 * `app/src/agent/extensions/capabilities.ts`.
 */
export const DEFAULT_FIXTURE_CAPABILITIES: Record<string, boolean> = {
  "bash.retainInactiveSessions": false,
  "graphql.mutations": false,
  "session.storeSessions": false,
  "subagents.enabled": false,
  "web.access": false,
};

/**
 * A deliberately stale capability snapshot that omits `subagents.enabled`,
 * reproducing localStorage written by a Phoenix build from before that key
 * existed. Hydrating this must backfill the missing key to a boolean so the
 * `/chat` request still serializes a valid `subagents` context instead of
 * dropping the field and triggering a backend 422 (see issue #13789 / #13788).
 *
 * To extend this regression fixture when a future capability key is added:
 * derive a new stale snapshot from {@link DEFAULT_FIXTURE_CAPABILITIES} that
 * omits the newly added key, and assert the hydrated `/chat` request still
 * includes that key's context with an explicit boolean in
 * `stale-capabilities.spec.ts`.
 */
export const STALE_CAPABILITIES_MISSING_SUBAGENTS: Record<string, boolean> =
  Object.fromEntries(
    Object.entries(DEFAULT_FIXTURE_CAPABILITIES).filter(
      ([key]) => key !== "subagents.enabled"
    )
  );
