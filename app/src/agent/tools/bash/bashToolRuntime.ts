import { Bash } from "just-bash";

import type { BashToolCommandResult, BashToolRuntime } from "./bashToolTypes";

export const DEFAULT_BASH_TOOL_CWD = "/home/user/workspace";

export async function createBashToolRuntime(): Promise<BashToolRuntime> {
  const bash = new Bash({
    cwd: DEFAULT_BASH_TOOL_CWD,
  });

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
