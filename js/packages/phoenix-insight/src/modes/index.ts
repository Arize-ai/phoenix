export * from "./types.js";
export * from "./sandbox.js";
export * from "./local.js";

import { SandboxMode } from "./sandbox.js";
import { LocalMode } from "./local.js";
import type { ExecutionMode } from "./types.js";

/**
 * Creates a new sandbox execution mode
 */
export function createSandboxMode(): ExecutionMode {
  return new SandboxMode();
}

/**
 * Creates a new local execution mode
 */
export async function createLocalMode(): Promise<ExecutionMode> {
  return new LocalMode();
}
