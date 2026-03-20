import type { InitialFiles } from "just-bash";

import { createBashToolRuntime } from "./bashToolRuntime";
import type { BashToolRuntime } from "./bashToolTypes";

const DEFAULT_BASH_TOOL_SESSION_KEY = "agent-default-session";

const bashToolSessionRegistry = new Map<string, Promise<BashToolRuntime>>();

export function getBashToolSessionKey(sessionId: string | null) {
  return sessionId ?? DEFAULT_BASH_TOOL_SESSION_KEY;
}

export function getOrCreateBashToolRuntime(sessionId: string | null) {
  const sessionKey = getBashToolSessionKey(sessionId);
  const existingRuntime = bashToolSessionRegistry.get(sessionKey);

  if (existingRuntime) {
    return existingRuntime;
  }

  const runtime = createBashToolRuntime();
  bashToolSessionRegistry.set(sessionKey, runtime);
  return runtime;
}

export async function replaceBashToolPhoenixContext(
  sessionId: string | null,
  initialFiles: InitialFiles
) {
  const sessionKey = getBashToolSessionKey(sessionId);
  const runtime = await getOrCreateBashToolRuntime(sessionId);
  await runtime.replacePhoenixFiles(initialFiles);

  const runtimePromise = Promise.resolve(runtime);
  bashToolSessionRegistry.set(sessionKey, runtimePromise);
  return runtimePromise;
}

export function clearBashToolRuntime(sessionId: string | null) {
  bashToolSessionRegistry.delete(getBashToolSessionKey(sessionId));
}

export function garbageCollectBashToolRuntimes({
  activeSessionId,
  sessionIds,
  retainInactiveSessions = false,
}: {
  activeSessionId: string | null;
  sessionIds: string[];
  retainInactiveSessions?: boolean;
}) {
  const liveSessionKeys = new Set(sessionIds.map(getBashToolSessionKey));

  if (activeSessionId !== null) {
    liveSessionKeys.add(getBashToolSessionKey(activeSessionId));
  }

  for (const sessionKey of bashToolSessionRegistry.keys()) {
    // The runtime belongs to a session that no longer exists in the store at
    // all, so it should always be reclaimed regardless of retention policy.
    if (!liveSessionKeys.has(sessionKey)) {
      bashToolSessionRegistry.delete(sessionKey);
      continue;
    }

    if (retainInactiveSessions) {
      continue;
    }

    // The session still exists, but it is not the currently active chat. In
    // today's single-session UX we evict it eagerly; session switching can
    // relax this branch later without changing the deleted-session branch above.
    if (
      activeSessionId !== null &&
      sessionKey !== getBashToolSessionKey(activeSessionId)
    ) {
      bashToolSessionRegistry.delete(sessionKey);
    }
  }
}
