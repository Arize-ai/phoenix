type FrontendToolDefinition = {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<
      string,
      {
        type: string;
        description: string;
      }
    >;
    required: string[];
    additionalProperties: boolean;
  };
};

export interface BashToolInput {
  command: string;
}

export const bashToolDefinition = {
  name: "bash",
  description:
    "Run a shell command in the browser virtual filesystem. Files persist across invocations, but the working directory resets between commands.",
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
