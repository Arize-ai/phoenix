import { css } from "@emotion/react";
import type { Meta, StoryObj } from "@storybook/react";

import type { ToolPartType } from "@phoenix/components/agent/ToolPart";
import { ToolPartGroup } from "@phoenix/components/agent/ToolPartGroup";

const containerCSS = css`
  max-width: 780px;
  width: 100%;
`;

// ---------------------------------------------------------------------------
// Mock data helpers
// ---------------------------------------------------------------------------

let partIdCounter = 0;

function makePart(overrides: Record<string, unknown>): ToolPartType {
  return {
    type: "dynamic-tool",
    toolCallId: `tool-call-${partIdCounter++}`,
    input: undefined,
    ...overrides,
  } as unknown as ToolPartType;
}

// Pre-built parts for various scenarios
const bashCompleted = (command: string, stdout: string) =>
  makePart({
    toolName: "bash",
    state: "output-available",
    input: { command },
    output: {
      command,
      stdout,
      stderr: "",
      exitCode: 0,
      durationMs: 120,
      startedAt: "2025-03-10T09:12:00Z",
      completedAt: "2025-03-10T09:12:00Z",
      stdoutBytes: stdout.length,
      stderrBytes: 0,
    },
  });

const bashFailed = (command: string, errorText: string) =>
  makePart({
    toolName: "bash",
    state: "output-error",
    input: { command },
    errorText,
  });

const bashRunning = (command: string) =>
  makePart({
    toolName: "bash",
    state: "input-available",
    input: { command },
  });

const readCompleted = (path: string) =>
  makePart({
    toolName: "read",
    state: "output-available",
    input: { path },
    output: `Contents of ${path}`,
  });

const editCompleted = (file: string) =>
  makePart({
    toolName: "edit",
    state: "output-available",
    input: { file, old_string: "old", new_string: "new" },
    output: "Edit applied",
  });

const grepCompleted = (pattern: string) =>
  makePart({
    toolName: "grep",
    state: "output-available",
    input: { pattern, path: "/workspace" },
    output: `Found 5 matches for "${pattern}"`,
  });

// ---------------------------------------------------------------------------
// Story data sets
// ---------------------------------------------------------------------------

const allCompletedParts: ToolPartType[] = [
  bashCompleted("npm test", "All 42 tests passed"),
  bashCompleted("npm run lint", "No lint errors"),
  readCompleted("/workspace/src/index.ts"),
  editCompleted("/workspace/src/App.tsx"),
  grepCompleted("TODO"),
];

const mixedStatusParts: ToolPartType[] = [
  bashCompleted("git status", "On branch main\nnothing to commit"),
  readCompleted("/workspace/package.json"),
  bashFailed("npm run build", "Module not found: @phoenix/missing"),
  editCompleted("/workspace/src/config.ts"),
  bashCompleted("npm test", "Tests passed"),
];

const inProgressParts: ToolPartType[] = [
  bashCompleted("npm install", "added 1203 packages"),
  bashRunning("npm run build"),
  bashRunning("npm test"),
  readCompleted("/workspace/tsconfig.json"),
];

const singlePart: ToolPartType[] = [bashCompleted("echo hello", "hello")];

const manyToolsParts: ToolPartType[] = [
  bashCompleted("ls src/", "App.tsx\nindex.ts\nutils/"),
  bashCompleted("cat package.json", '{"name": "phoenix"}'),
  readCompleted("/workspace/src/App.tsx"),
  readCompleted("/workspace/src/index.ts"),
  readCompleted("/workspace/src/utils/helpers.ts"),
  editCompleted("/workspace/src/App.tsx"),
  editCompleted("/workspace/src/index.ts"),
  grepCompleted("import"),
  grepCompleted("export"),
  bashCompleted("npm test", "42 tests passed"),
  bashCompleted("npm run lint", "No issues found"),
  bashCompleted("npm run build", "Build completed in 2.3s"),
];

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

const meta = {
  title: "Agent/ToolPartGroup",
  component: ToolPartGroup,
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
} satisfies Meta<typeof ToolPartGroup>;

export default meta;

type Story = StoryObj<typeof meta>;

/** All tool calls completed successfully. */
export const AllCompleted: Story = {
  args: { parts: allCompletedParts },
};

/** Mix of completed and failed tool calls. */
export const WithFailures: Story = {
  args: { parts: mixedStatusParts },
};

/** Some tool calls still running. */
export const InProgress: Story = {
  args: { parts: inProgressParts },
};

/** A group containing a single tool call. */
export const SingleTool: Story = {
  args: { parts: singlePart },
};

/** A large group with many different tool types. */
export const ManyTools: Story = {
  args: { parts: manyToolsParts },
};
