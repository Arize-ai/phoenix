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
