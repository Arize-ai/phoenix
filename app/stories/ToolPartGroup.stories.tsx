import { css } from "@emotion/react";
import type { Meta, StoryObj } from "@storybook/react";

import type { ToolPartType } from "@phoenix/components/agent/ToolPart";
import { ToolPartGroup } from "@phoenix/components/agent/ToolPartGroup";

const containerCSS = css`
  max-width: 780px;
  width: 100%;
`;

const narrowContainerCSS = css`
  max-width: 360px;
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

const toolCompleted = (
  toolName: string,
  input: Record<string, unknown>,
  output: unknown
) =>
  makePart({
    toolName,
    state: "output-available",
    input,
    output,
  });

const toolFailed = (
  toolName: string,
  input: Record<string, unknown>,
  errorText: string
) =>
  makePart({
    toolName,
    state: "output-error",
    input,
    errorText,
  });

const toolRunning = (toolName: string, input: Record<string, unknown>) =>
  makePart({
    toolName,
    state: "input-available",
    input,
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

const longToolNamesWithFailureParts: ToolPartType[] = [
  toolCompleted(
    "generate_customer_facing_release_readiness_report",
    { release: "2026.05", include_open_risks: true },
    { status: "ready" }
  ),
  toolCompleted(
    "synchronize_enterprise_permission_boundary_templates",
    { workspace: "acme-prod", template_count: 14 },
    { synced: 14 }
  ),
  toolFailed(
    "reconcile_customer_managed_encryption_key_rotation",
    { account: "acme-prod", region: "us-east-1" },
    "Timed out waiting for the remote key policy check to finish."
  ),
  toolCompleted(
    "validate_multiregion_warehouse_lineage_backfill_configuration",
    { dataset: "analytics.events", backfill_window_days: 90 },
    { status: "valid" }
  ),
];

const repeatedLongToolNamesWithFailureParts: ToolPartType[] = [
  toolCompleted(
    "fetch_cross_workspace_dependency_graph_snapshot",
    { workspace: "design-system" },
    { node_count: 184 }
  ),
  toolCompleted(
    "fetch_cross_workspace_dependency_graph_snapshot",
    { workspace: "product-app" },
    { node_count: 267 }
  ),
  toolCompleted(
    "compile_customer_visible_operational_readiness_summary",
    { audience: "support" },
    { sections: 9 }
  ),
  toolFailed(
    "diff_regional_data_residency_exception_registry",
    { region_group: "eu" },
    "Could not load the residency exception manifest for eu-west-3."
  ),
];

const longToolNamesInProgressParts: ToolPartType[] = [
  toolCompleted(
    "index_historical_conversation_context_for_regression_review",
    { conversation_count: 128 },
    { indexed: 128 }
  ),
  toolRunning("hydrate_customer_specific_prompt_compliance_checklist", {
    customer: "acme-bank",
    policy_version: "2026-05",
  }),
  toolRunning("calculate_multimodal_attachment_retention_exceptions", {
    workspace: "security-audit",
    include_archived: true,
  }),
  toolCompleted(
    "summarize_workspace_level_authz_change_history",
    { actor_count: 23 },
    { pages: 4 }
  ),
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

/** Long tool names with a compound error state to exercise header wrapping. */
export const LongToolNamesWithFailure: Story = {
  args: { parts: longToolNamesWithFailureParts },
};

/** Repeated long tool names with a failure to stress the breakdown count labels. */
export const RepeatedLongToolNamesWithFailure: Story = {
  args: { parts: repeatedLongToolNamesWithFailureParts },
};

/** Long tool names in a narrow container to force wrapping while tools are still running. */
export const NarrowLongToolNamesInProgress: Story = {
  args: { parts: longToolNamesInProgressParts },
  render: (args) => (
    <div css={narrowContainerCSS}>
      <ToolPartGroup {...args} />
    </div>
  ),
};
