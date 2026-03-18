import type { FrontendToolDefinition } from "@phoenix/agent/tools/types";

import { BASH_TOOL_CAPABILITY_DESCRIPTION } from "./bashToolCapabilities";

export interface BashToolInput {
  command: string;
}

// This description follows the same capability-guidance approach used by
// bash-tool, adapted for the browser-only just-bash environment.
export const bashToolDefinition = {
  name: "bash",
  description: `Run a shell command in the browser virtual filesystem. ${BASH_TOOL_CAPABILITY_DESCRIPTION}`,
  parameters: {
    type: "object",
    properties: {
      command: {
        type: "string",
        description: "Shell command to execute",
      },
    },
    required: ["command"],
    additionalProperties: false,
  },
} satisfies FrontendToolDefinition;

export function getBashToolInput(input: unknown): BashToolInput | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const { command } = input as Partial<BashToolInput>;

  if (typeof command !== "string") {
    return null;
  }

  return { command };
}
