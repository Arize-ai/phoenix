/**
 * Client-side tool descriptor sent with agent chat requests so the backend can
 * advertise frontend-executable tools to the model.
 */
import type { FrontendToolDefinition } from "@phoenix/agent/tools/types";

export interface BashToolInput {
  command: string;
}

// This description follows the same capability-guidance approach used by
// bash-tool, adapted for the browser-only just-bash environment.
export const bashToolDefinition = {
  name: "bash",
  description:
    "Run a shell command in the browser virtual filesystem. Files persist across invocations, but the working directory resets between commands. Network is disabled by default, and this environment should be used for local file inspection and data parsing rather than package installation or host-level system setup.",
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
