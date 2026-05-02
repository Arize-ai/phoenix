import { css } from "@emotion/react";
import type { Meta, StoryObj } from "@storybook/react";

import {
  ToolPart,
  type ToolPartType,
} from "@phoenix/components/agent/ToolPart";

const containerCSS = css`
  max-width: 780px;
  width: 100%;
`;

// ---------------------------------------------------------------------------
// Mock data helpers
// ---------------------------------------------------------------------------

/**
 * Build a mock tool part. We cast through `unknown` because the
 * `ToolPartType` union is complex — in real code only the AI SDK
 * constructs these, but for stories we just need valid shapes.
 */
function makePart(overrides: Record<string, unknown>): ToolPartType {
  return {
    type: "dynamic-tool",
    toolCallId: crypto.randomUUID(),
    input: undefined,
    ...overrides,
  } as unknown as ToolPartType;
}

const bashCompletedPart = makePart({
  toolName: "bash",
  state: "output-available",
  input: { command: "ls -la /workspace/src" },
  output: {
    command: "ls -la /workspace/src",
    stdout:
      "total 48\ndrwxr-xr-x  12 user  staff   384 Mar 10 09:12 .\ndrwxr-xr-x   8 user  staff   256 Mar 10 09:12 ..\n-rw-r--r--   1 user  staff  1234 Mar 10 09:12 index.ts\n-rw-r--r--   1 user  staff  5678 Mar 10 09:12 App.tsx",
    stderr: "",
    exitCode: 0,
    durationMs: 42,
    startedAt: "2025-03-10T09:12:00Z",
    completedAt: "2025-03-10T09:12:00Z",
    stdoutBytes: 240,
    stderrBytes: 0,
  },
});

const bashFailedPart = makePart({
  toolName: "bash",
  state: "output-error",
  input: { command: "npm run build" },
  errorText: "Process exited with code 1: Module not found: @phoenix/missing",
});

const bashRunningPart = makePart({
  toolName: "bash",
  state: "input-available",
  input: { command: "python train.py --epochs 100" },
});

const bashStreamingPart = makePart({
  toolName: "bash",
  state: "input-streaming",
  input: { command: "curl https://api.example" },
});

const readPart = makePart({
  toolName: "read",
  state: "output-available",
  input: { path: "/workspace/src/config.ts" },
  output: 'export const API_URL = "https://api.arize.com";',
});

const editPart = makePart({
  toolName: "edit",
  state: "output-available",
  input: {
    file: "/workspace/src/App.tsx",
    old_string: 'const title = "Hello"',
    new_string: 'const title = "Hello, Phoenix"',
  },
  output: "Edit applied successfully",
});

const _grepPart = makePart({
  toolName: "grep",
  state: "output-available",
  input: { pattern: "TODO", path: "/workspace/src" },
  output: "Found 3 matches in 2 files",
});

const deniedPart = makePart({
  toolName: "bash",
  state: "output-denied",
  input: { command: "rm -rf /workspace/node_modules" },
  approval: {
    id: "approval-1",
    approved: false,
    reason: "Destructive operation",
  },
});

const approvalRequestedPart = makePart({
  toolName: "bash",
  state: "approval-requested",
  input: { command: "git push origin main --force" },
  approval: { id: "approval-2" },
});

// ---------------------------------------------------------------------------
// ToolPart stories
// ---------------------------------------------------------------------------

const toolPartMeta = {
  title: "Agent/ToolPart",
  component: ToolPart,
  decorators: [
    (Story) => (
      <div css={containerCSS}>
        <Story />
      </div>
    ),
  ],
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof ToolPart>;

export default toolPartMeta;

type Story = StoryObj<typeof toolPartMeta>;

/** A bash tool call that completed successfully with stdout output. */
export const BashCompleted: Story = {
  args: { part: bashCompletedPart },
};

/** A bash tool call that failed with an error message. */
export const BashFailed: Story = {
  args: { part: bashFailedPart },
};

/** A bash tool call currently running (input-available state). */
export const BashRunning: Story = {
  args: { part: bashRunningPart },
};

/** A bash tool call still streaming its input. */
export const BashStreaming: Story = {
  args: { part: bashStreamingPart },
};

/** A non-bash tool (read) with JSON-rendered input and output. */
export const ReadTool: Story = {
  args: { part: readPart },
};

/** An edit tool call showing a file modification. */
export const EditTool: Story = {
  args: { part: editPart },
};

/** A tool call that was denied by the user. */
export const Denied: Story = {
  args: { part: deniedPart },
};

/** A tool call awaiting user approval. */
export const ApprovalRequested: Story = {
  args: { part: approvalRequestedPart },
};
