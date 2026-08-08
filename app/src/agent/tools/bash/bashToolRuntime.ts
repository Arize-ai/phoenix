import { Bash, type BashOptions } from "just-bash";

import {
  applyBashToolFilesystemPolicy,
  BASH_TOOL_TMP_ROOT,
  BASH_TOOL_WORKSPACE_ROOT,
} from "./bashToolFilesystemPolicy";
import type { BashToolCommandResult, BashToolRuntime } from "./bashToolTypes";
import {
  createDefaultBashCustomCommandPolicy,
  type BashCustomCommandPolicy,
} from "./customCommandPolicy";
import { createPhoenixGqlCommand } from "./phoenixGqlCommand";

/**
 * Default working directory for the browser bash runtime scratch space.
 */
export const DEFAULT_BASH_TOOL_CWD = BASH_TOOL_WORKSPACE_ROOT;

type BashExecutionLimits = NonNullable<BashOptions["executionLimits"]>;

/**
 * Guardrails applied to each just-bash runtime to bound work and output size.
 */
export const DEFAULT_BASH_TOOL_EXECUTION_LIMITS = {
  maxCallDepth: 50,
  maxCommandCount: 200,
  maxLoopIterations: 1000,
  maxAwkIterations: 1000,
  maxSedIterations: 1000,
  maxJqIterations: 1000,
  maxSqliteTimeoutMs: 2000,
  maxJsTimeoutMs: 2000,
  maxGlobOperations: 10000,
  maxStringLength: 1024 * 1024,
  maxArrayElements: 10000,
  maxHeredocSize: 1024 * 1024,
  maxSubstitutionDepth: 20,
  maxBraceExpansionResults: 1000,
  maxOutputSize: 256 * 1024,
  maxFileDescriptors: 128,
  maxSourceDepth: 20,
} satisfies BashExecutionLimits;

function getByteLength(content: string) {
  return new TextEncoder().encode(content).byteLength;
}

function createInstrumentedCommandResult({
  command,
  result,
  startedAt,
  completedAt,
  durationMs,
}: {
  command: string;
  result: Awaited<ReturnType<Bash["exec"]>>;
  startedAt: string;
  completedAt: string;
  durationMs: number;
}): BashToolCommandResult {
  return {
    command,
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode,
    durationMs,
    startedAt,
    completedAt,
    stdoutBytes: getByteLength(result.stdout),
    stderrBytes: getByteLength(result.stderr),
  };
}

/**
 * Creates an instrumented just-bash runtime with the Phoenix filesystem policy
 * and the scratch directories the model is allowed to write to.
 */
export async function createBashToolRuntime(): Promise<BashToolRuntime> {
  const runtimePolicyRef: { current: BashCustomCommandPolicy } = {
    current: createDefaultBashCustomCommandPolicy(),
  };

  // We execute just-bash directly in the browser for now.
  // Future reference: bash-tool's browser work is being explored in
  // https://github.com/vercel-labs/bash-tool/pull/7
  const bash = new Bash({
    cwd: DEFAULT_BASH_TOOL_CWD,
    customCommands: [
      createPhoenixGqlCommand({
        getPolicy: () => runtimePolicyRef.current,
      }),
    ],
    executionLimits: DEFAULT_BASH_TOOL_EXECUTION_LIMITS,
  });
  applyBashToolFilesystemPolicy(bash.fs);

  await bash.fs.mkdir(BASH_TOOL_WORKSPACE_ROOT, { recursive: true });
  await bash.fs.mkdir(BASH_TOOL_TMP_ROOT, { recursive: true });

  return {
    executeCommand: async (
      command,
      options
    ): Promise<BashToolCommandResult> => {
      const startedAt = new Date().toISOString();
      const startTime = performance.now();
      runtimePolicyRef.current =
        options?.customCommandPolicy ?? createDefaultBashCustomCommandPolicy();
      const result = await bash.exec(command, {
        signal: options?.signal,
        env: options?.env,
      });
      const completedAt = new Date().toISOString();

      return createInstrumentedCommandResult({
        command,
        result,
        startedAt,
        completedAt,
        durationMs: Math.round(performance.now() - startTime),
      });
    },
  };
}
