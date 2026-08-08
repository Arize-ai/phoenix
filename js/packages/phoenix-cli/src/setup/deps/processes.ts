/**
 * The subprocess capability: one-shot probes (git checks, agent detection)
 * and the interactive agent hand-off share these contracts and this runner.
 */

import * as process from "node:process";
// cross-spawn resolves .cmd/.bat shims on Windows (npm, npx, agent CLIs),
// where node's bare spawn fails with ENOENT unless given a shell.
import spawn from "cross-spawn";

export interface CommandSpec {
  command: string;
  args: string[];
  stdin?: string;
  env?: Record<string, string>;
  cwd?: string;
  /** Kill the child and resolve non-zero once this many ms elapse. */
  timeoutMs?: number;
}

export interface ExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface ProcessRunner {
  /** One-shot subprocess (git, probes). Never throws on non-zero exit. */
  exec(spec: CommandSpec): Promise<ExecResult>;
  /** Interactive subprocess with inherited stdio (agent hand-off). */
  spawnInteractive(spec: CommandSpec): Promise<{ exitCode: number }>;
}

function execOnce(spec: CommandSpec): Promise<ExecResult> {
  return new Promise((resolve) => {
    const child = spawn(spec.command, spec.args, {
      cwd: spec.cwd,
      env: spec.env ? { ...process.env, ...spec.env } : process.env,
      stdio: ["pipe", "pipe", "pipe"],
      // Kills the child on expiry — a hung probe must not leave an orphaned
      // subprocess behind. Surfaces as a non-zero exit via `close`.
      timeout: spec.timeoutMs,
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf-8");
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf-8");
    });
    child.on("error", (error) => {
      // Command not found and similar spawn failures surface as a non-zero
      // exit with the message on stderr rather than a throw.
      resolve({ exitCode: 127, stdout, stderr: String(error) });
    });
    child.on("close", (code) => {
      resolve({ exitCode: code ?? 1, stdout, stderr });
    });
    if (spec.stdin !== undefined) {
      child.stdin?.write(spec.stdin);
    }
    child.stdin?.end();
  });
}

function spawnInteractiveChild(spec: CommandSpec): Promise<{
  exitCode: number;
}> {
  return new Promise((resolve) => {
    const child = spawn(spec.command, spec.args, {
      cwd: spec.cwd,
      env: spec.env ? { ...process.env, ...spec.env } : process.env,
      stdio: "inherit",
    });
    child.on("error", () => resolve({ exitCode: 127 }));
    child.on("close", (code) => resolve({ exitCode: code ?? 1 }));
  });
}

export function createSystemProcessRunner(): ProcessRunner {
  return {
    exec: execOnce,
    spawnInteractive: spawnInteractiveChild,
  };
}
