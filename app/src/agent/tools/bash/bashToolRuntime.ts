import { Bash } from "just-bash";

import {
  applyBashToolFilesystemPolicy,
  BASH_TOOL_WORKSPACE_ROOT,
} from "./bashToolFilesystemPolicy";
import type { BashToolCommandResult, BashToolRuntime } from "./bashToolTypes";

export const DEFAULT_BASH_TOOL_CWD = BASH_TOOL_WORKSPACE_ROOT;

export async function createBashToolRuntime(): Promise<BashToolRuntime> {
  // We execute just-bash directly in the browser for now.
  // Future reference: bash-tool's browser work is being explored in
  // https://github.com/vercel-labs/bash-tool/pull/7
  const bash = new Bash({
    cwd: DEFAULT_BASH_TOOL_CWD,
  });
  applyBashToolFilesystemPolicy(bash.fs);

  return {
    executeCommand: async (command): Promise<BashToolCommandResult> => {
      const result = await bash.exec(command);

      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
      };
    },
  };
}
