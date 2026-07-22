/**
 * The ambient facts of a run, captured once at startup.
 *
 * Plain data, not behavior: steps read these values, they never call through
 * them. Keeping the snapshot in one place is what stops `process.env` and
 * `process.cwd()` reads from leaking into steps.
 */

import * as process from "node:process";

export interface RunContext {
  cwd: string;
  env: Record<string, string | undefined>;
  /**
   * How PATH is spelled in {@link env}. `process.env` resolves names
   * case-insensitively on Windows, where the variable is conventionally
   * "Path"; the plain copy below is an ordinary object and does not, so the
   * spelling is resolved once here rather than by each reader. Read PATH as
   * `env[pathKey]`, and when overriding it for a child process use this key —
   * spawning with "PATH" while the inherited environment carries "Path" hands
   * the child two of them.
   */
  pathKey: string;
  stdinIsTTY: boolean;
  /** Override the px settings file location (tests only). */
  settingsPath?: string;
}

/** The key PATH is spelled under, or "PATH" when the env carries none. */
export function resolvePathKey(
  env: Record<string, string | undefined>
): string {
  return Object.keys(env).find((key) => key.toUpperCase() === "PATH") ?? "PATH";
}

export function captureRunContext(): RunContext {
  // Copied, not aliased — a mid-run mutation of process.env (a spawned
  // tool, a late dotenv load) must not change what this run resolved.
  const env = { ...process.env };
  return {
    cwd: process.cwd(),
    env,
    pathKey: resolvePathKey(env),
    stdinIsTTY: Boolean(process.stdin.isTTY),
  };
}
