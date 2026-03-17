import { Bash, type BashOptions } from "just-bash";

import {
  applyBashToolFilesystemPolicy,
  BASH_TOOL_WORKSPACE_ROOT,
} from "./bashToolFilesystemPolicy";
import type { BashToolCommandResult, BashToolRuntime } from "./bashToolTypes";

export const DEFAULT_BASH_TOOL_CWD = BASH_TOOL_WORKSPACE_ROOT;

type BashExecutionLimits = NonNullable<BashOptions["executionLimits"]>;

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
  maxHeredocSize: 256 * 1024,
  maxSubstitutionDepth: 20,
  maxBraceExpansionResults: 1000,
  maxOutputSize: 256 * 1024,
  maxFileDescriptors: 128,
  maxSourceDepth: 20,
} satisfies BashExecutionLimits;

export async function createBashToolRuntime(): Promise<BashToolRuntime> {
  // We execute just-bash directly in the browser for now.
  // Future reference: bash-tool's browser work is being explored in
  // https://github.com/vercel-labs/bash-tool/pull/7
  const bash = new Bash({
    cwd: DEFAULT_BASH_TOOL_CWD,
    executionLimits: DEFAULT_BASH_TOOL_EXECUTION_LIMITS,
  });
  applyBashToolFilesystemPolicy(bash.fs);

  return {
    executeCommand: async (
      command,
      options
    ): Promise<BashToolCommandResult> => {
      const result = await bash.exec(command, {
        signal: options?.signal,
      });

      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
      };
    },
  };
}
