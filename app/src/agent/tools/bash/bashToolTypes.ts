import type { InitialFiles } from "just-bash";

export interface BashToolCommandResult {
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  startedAt: string;
  completedAt: string;
  stdoutBytes: number;
  stderrBytes: number;
}

export interface BashToolCommandDisplayResult {
  exitCode: string;
  stdout: string;
  stderr: string;
  durationText: string | null;
  stdoutBytesText: string | null;
  stderrBytesText: string | null;
}

function formatDuration(durationMs: number) {
  if (durationMs < 1000) {
    return `${durationMs} ms`;
  }

  return `${(durationMs / 1000).toFixed(2)} s`;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  return `${(bytes / 1024).toFixed(1)} KB`;
}

export function isBashToolCommandResult(
  value: unknown
): value is BashToolCommandResult {
  if (!value || typeof value !== "object") {
    return false;
  }

  const result = value as Partial<BashToolCommandResult>;

  return (
    typeof result.command === "string" &&
    typeof result.stdout === "string" &&
    typeof result.stderr === "string" &&
    typeof result.exitCode === "number" &&
    typeof result.durationMs === "number" &&
    typeof result.startedAt === "string" &&
    typeof result.completedAt === "string" &&
    typeof result.stdoutBytes === "number" &&
    typeof result.stderrBytes === "number"
  );
}

export function getBashToolCommandDisplayResult(
  value: unknown
): BashToolCommandDisplayResult | null {
  if (!isBashToolCommandResult(value)) {
    return null;
  }

  return {
    exitCode: String(value.exitCode),
    stdout: value.stdout,
    stderr: value.stderr,
    durationText: formatDuration(value.durationMs),
    stdoutBytesText: formatBytes(value.stdoutBytes),
    stderrBytesText: formatBytes(value.stderrBytes),
  };
}

export interface BashToolRuntime {
  executeCommand: (
    command: string,
    options?: {
      signal?: AbortSignal;
    }
  ) => Promise<BashToolCommandResult>;
  replacePhoenixFiles: (files: InitialFiles) => Promise<void>;
}
