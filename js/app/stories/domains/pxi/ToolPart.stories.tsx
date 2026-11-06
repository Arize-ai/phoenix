import { css } from "@emotion/react";
import type { Meta, StoryObj } from "@storybook/react";
import type { ReactNode } from "react";
import { useState } from "react";

import type { PendingDatasetWrite } from "@phoenix/agent/shared/pendingDatasetWrite";
import {
  CREATE_ANNOTATION_CONFIG_TOOL_NAME,
  UPDATE_ANNOTATION_CONFIG_TOOL_NAME,
  type PendingAnnotationConfigWrite,
} from "@phoenix/agent/tools/annotationConfig";
import {
  BATCH_SPAN_ANNOTATE_TOOL_NAME,
  type PendingBatchSpanAnnotate,
} from "@phoenix/agent/tools/batchSpanAnnotate";
import { CREATE_DATASET_TOOL_NAME } from "@phoenix/agent/tools/createDataset";
import {
  DELETE_DATASET_TOOL_NAME,
  PATCH_DATASET_TOOL_NAME,
} from "@phoenix/agent/tools/datasetEdit";
import {
  ADD_DATASET_EXAMPLES_TOOL_NAME,
  DELETE_DATASET_EXAMPLES_TOOL_NAME,
  PATCH_DATASET_EXAMPLES_TOOL_NAME,
} from "@phoenix/agent/tools/datasetExamples";
import {
  CREATE_DATASET_LABEL_TOOL_NAME,
  DELETE_DATASET_LABELS_TOOL_NAME,
  SET_DATASET_LABELS_TOOL_NAME,
} from "@phoenix/agent/tools/datasetLabels";
import {
  CREATE_DATASET_SPLIT_TOOL_NAME,
  DELETE_DATASET_SPLITS_TOOL_NAME,
  PATCH_DATASET_SPLIT_TOOL_NAME,
  SET_DATASET_EXAMPLE_SPLITS_TOOL_NAME,
} from "@phoenix/agent/tools/datasetSplits";
import {
  DOCS_FILESYSTEM_QUERY_TOOL_NAME,
  DOCS_SEARCH_TOOL_NAME,
} from "@phoenix/agent/tools/docs";
import {
  PATCH_EXPERIMENT_TOOL_NAME,
  type PendingPatchExperiment,
} from "@phoenix/agent/tools/patchExperiment";
import { ADD_SPANS_TO_DATASET_TOOL_NAME } from "@phoenix/agent/tools/spansToDataset";
import {
  renderUIOperationCatalog,
  searchUIOperations,
} from "@phoenix/agent/uiOperations/catalog";
import {
  EXECUTE_BROWSER_ACTION_TOOL_NAME,
  SCRIPT_REJECTED_OUTPUT,
} from "@phoenix/agent/uiOperations/executeBrowserActionTool";
import { playgroundPromptOperations } from "@phoenix/agent/uiOperations/operations/playgroundPrompt";
import { SEARCH_BROWSER_ACTIONS_TOOL_NAME } from "@phoenix/agent/uiOperations/searchBrowserActionsTool";
import { Flex, Text } from "@phoenix/components";
import {
  ElicitationDraftProvider,
  type PendingElicitationDraft,
} from "@phoenix/components/agent/ElicitationDraftContext";
import {
  ToolPart,
  type ToolPartType,
} from "@phoenix/components/agent/ToolPart";
import { AgentChatRuntimeProvider } from "@phoenix/contexts/AgentChatRuntimeContext";
import { AgentContext } from "@phoenix/contexts/AgentContext";
import { createAgentStore } from "@phoenix/store/agentStore";

const containerCSS = css`
  max-width: 780px;
  width: 100%;
`;

type AgentStore = ReturnType<typeof createAgentStore>;

function AgentStoreStoryProvider({
  children,
  setupStore,
}: {
  children: ReactNode;
  /** Stages pending state, such as an approval, on this state's store. */
  setupStore?: (store: AgentStore) => void;
}) {
  const [store] = useState(() => {
    const store = createAgentStore();
    setupStore?.(store);
    return store;
  });

  return (
    <AgentContext.Provider value={store}>
      <AgentChatRuntimeProvider>{children}</AgentChatRuntimeProvider>
    </AgentContext.Provider>
  );
}

/** One labeled state in a tool family's stack. */
type ToolPartState = {
  label: string;
  /** Why the state looks the way it does, when the label alone cannot say. */
  description?: ReactNode;
  part: ToolPartType;
  /** Defaults to open so the body is visible. */
  defaultOpen?: boolean;
  setupStore?: (store: AgentStore) => void;
  elicitationDraft?: PendingElicitationDraft;
};

function ToolPartStateItem({
  label,
  description,
  part,
  defaultOpen = true,
  setupStore,
  elicitationDraft,
}: ToolPartState) {
  const toolPart = <ToolPart part={part} defaultOpen={defaultOpen} />;
  return (
    <Flex direction="column" gap="size-100">
      <Text size="S" color="text-700">
        {label}
      </Text>
      {description ? (
        <Text size="XS" color="text-500">
          {description}
        </Text>
      ) : null}
      <AgentStoreStoryProvider setupStore={setupStore}>
        {elicitationDraft ? (
          <ElicitationDraftProvider draft={elicitationDraft}>
            {toolPart}
          </ElicitationDraftProvider>
        ) : (
          toolPart
        )}
      </AgentStoreStoryProvider>
    </Flex>
  );
}

function ToolPartStates({ states }: { states: ToolPartState[] }) {
  return (
    <Flex direction="column" gap="size-400">
      {states.map((state) => (
        <ToolPartStateItem key={state.label} {...state} />
      ))}
    </Flex>
  );
}

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

const bashErrorPart = makePart({
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

const bashMultilineCommandPart = makePart({
  toolName: "bash",
  state: "output-available",
  input: {
    command: `docker run -d \\
  --name phoenix-db \\
  -e POSTGRES_USER=phoenix \\
  -e POSTGRES_PASSWORD=secret \\
  -e POSTGRES_DB=phoenix \\
  -p 5432:5432 \\
  postgres:15`,
  },
  output: {
    command: `docker run -d \\
  --name phoenix-db \\
  -e POSTGRES_USER=phoenix \\
  -e POSTGRES_PASSWORD=secret \\
  -e POSTGRES_DB=phoenix \\
  -p 5432:5432 \\
  postgres:15`,
    stdout: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6",
    stderr: "",
    exitCode: 0,
    durationMs: 1523,
    startedAt: "2025-03-10T09:12:00Z",
    completedAt: "2025-03-10T09:12:01Z",
    stdoutBytes: 52,
    stderrBytes: 0,
  },
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
// AskUser tool mocks
// ---------------------------------------------------------------------------

const askUserAwaitingPart = makePart({
  toolName: "ask_user",
  toolCallId: "ask-user-awaiting",
  state: "input-available",
  input: {
    questions: [
      {
        id: "q-database",
        type: "single",
        prompt: "Which database would you like to use?",
        options: [
          {
            id: "postgres",
            label: "PostgreSQL",
            description: "Recommended for production",
          },
          {
            id: "sqlite",
            label: "SQLite",
            description: "Great for development",
          },
          { id: "mysql", label: "MySQL", description: "Legacy support" },
        ],
        allow_skip: false,
        allow_freeform: false,
      },
      {
        id: "q-dbname",
        type: "freeform",
        prompt: "What should we name the database?",
      },
    ],
  },
});

const askUserAnsweredPart = makePart({
  toolName: "ask_user",
  toolCallId: "ask-user-answered",
  state: "output-available",
  input: {
    questions: [
      {
        id: "q-environment",
        type: "single",
        prompt: "Which environment should we deploy to?",
        options: [
          { id: "staging", label: "staging", description: "For testing" },
          { id: "production", label: "production", description: "Live users" },
        ],
        allow_skip: false,
        allow_freeform: false,
      },
    ],
  },
  output: {
    answers: { "q-environment": ["staging"] },
    freeformTexts: {},
  },
});

const askUserInvalidInputPart = makePart({
  toolName: "ask_user",
  toolCallId: "ask-user-invalid-input",
  state: "output-error",
  input: {
    questions: [],
  },
  errorText:
    "Invalid ask_user tool input. Expected { questions: ElicitationQuestion[] }.",
});

const askUserDraftInProgressPart = makePart({
  toolName: "ask_user",
  toolCallId: "ask-user-draft-progress",
  state: "input-available",
  input: {
    questions: [
      {
        id: "q-provider",
        type: "single",
        prompt: "Which provider should we configure?",
        options: [
          { id: "openai", label: "OpenAI" },
          { id: "anthropic", label: "Anthropic" },
        ],
        allow_skip: false,
        allow_freeform: false,
      },
      {
        id: "q-context",
        type: "freeform",
        prompt: "Add any deployment constraints.",
        allow_skip: false,
        allow_freeform: false,
      },
      {
        id: "q-region",
        type: "single",
        prompt: "Which region should we target?",
        options: [
          { id: "us", label: "US" },
          { id: "eu", label: "EU" },
        ],
        allow_skip: false,
        allow_freeform: false,
      },
    ],
  },
});

const askUserDraftInProgress = {
  toolCallId: "ask-user-draft-progress",
  answers: {
    "q-provider": ["anthropic"],
  },
  freeformTexts: {},
  currentIndex: 1,
} satisfies PendingElicitationDraft;

const askUserBlankCustomPart = makePart({
  toolName: "ask_user",
  toolCallId: "ask-user-blank-custom",
  state: "input-available",
  input: {
    questions: [
      {
        id: "q-runtime",
        type: "single",
        prompt: "Which runtime should we target?",
        options: [{ id: "python", label: "Python" }],
        allow_skip: false,
        allow_freeform: true,
      },
    ],
  },
});

const askUserBlankCustomDraft = {
  toolCallId: "ask-user-blank-custom",
  answers: {
    "q-runtime": ["__freeform__"],
  },
  freeformTexts: {},
  currentIndex: 0,
} satisfies PendingElicitationDraft;

const askUserSkippedPart = makePart({
  toolName: "ask_user",
  toolCallId: "ask-user-skipped",
  state: "output-available",
  input: {
    questions: [
      {
        id: "q-confirm",
        type: "single",
        prompt: "Should we also set up production monitoring?",
        options: [
          { id: "yes", label: "Yes" },
          { id: "no", label: "No" },
        ],
        allow_skip: true,
        allow_freeform: false,
      },
    ],
  },
  output: {
    answers: {},
    freeformTexts: {},
  },
});

const askUserCancelledPart = makePart({
  toolName: "ask_user",
  toolCallId: "ask-user-cancelled",
  state: "output-error",
  input: {
    questions: [
      {
        id: "q-auth",
        type: "single",
        prompt: "Which auth provider should we configure?",
        options: [
          { id: "oidc", label: "OIDC" },
          { id: "saml", label: "SAML" },
        ],
        allow_skip: false,
        allow_freeform: false,
      },
    ],
  },
  errorText: "User cancelled the question.",
});

const askUserResumeFailedPart = makePart({
  toolName: "ask_user",
  toolCallId: "ask-user-resume-failed",
  state: "output-error",
  input: {
    questions: [
      {
        id: "q-region",
        type: "single",
        prompt: "Which region should we deploy to?",
        options: [
          { id: "us", label: "US" },
          { id: "eu", label: "EU" },
        ],
        allow_skip: false,
        allow_freeform: false,
      },
    ],
  },
  errorText:
    "This pending question could not be resumed after reopening the conversation.",
});

// ---------------------------------------------------------------------------
// Docs tool mocks
// ---------------------------------------------------------------------------

const docsSearchPart = makePart({
  toolName: DOCS_SEARCH_TOOL_NAME,
  state: "output-available",
  input: { query: "how to configure tracing" },
  output:
    "Found 3 results:\n\n1. Getting Started with Tracing\n   /docs/tracing/quickstart\n\n2. Tracing Configuration Options\n   /docs/tracing/configuration\n\n3. Advanced Tracing Patterns\n   /docs/tracing/advanced",
});

const docsSearchRunningPart = makePart({
  toolName: DOCS_SEARCH_TOOL_NAME,
  state: "input-available",
  input: { query: "embeddings visualization" },
});

const docsFileSystemQueryPart = makePart({
  toolName: DOCS_FILESYSTEM_QUERY_TOOL_NAME,
  state: "output-available",
  input: { command: "head -80 /docs/tracing/quickstart.mdx" },
  output:
    "# Getting Started with Tracing\n\nPhoenix tracing helps you understand your LLM application's behavior...\n\n## Installation\n\n```bash\npip install arize-phoenix\n```\n\n## Quick Start\n\nImport and initialize the tracer:\n\n```python\nimport phoenix as px\npx.launch_app()\n```",
});

const docsFileSystemQueryRunningPart = makePart({
  toolName: DOCS_FILESYSTEM_QUERY_TOOL_NAME,
  state: "input-available",
  input: { command: "head -80 /docs/evaluation/overview.mdx" },
});

const loadSkillRunningPart = makePart({
  toolName: "load_skill",
  state: "input-available",
  input: { skill_name: "phoenix-frontend" },
});

const loadSkillCompletedPart = makePart({
  toolName: "load_skill",
  state: "output-available",
  input: { skill_name: "phoenix-frontend" },
  output:
    "# Phoenix Frontend Development Guide\n\nThis skill provides guidance for working with the Phoenix frontend codebase...\n\n## Key Concepts\n\n- Components live in `src/components`\n- Use Emotion for styling\n- Follow the design system tokens",
});

const loadSkillErrorPart = makePart({
  toolName: "load_skill",
  state: "output-error",
  input: { skill_name: "unknown-skill" },
  errorText: "Skill 'unknown-skill' not found in the skill registry.",
});

const loadSkillReferenceInput = {
  skill_name: "phoenix-graphql",
  reference_name: "project-spans-traces.md",
};

const loadSkillReferenceCompletedPart = makePart({
  toolName: "load_skill_reference",
  state: "output-available",
  input: loadSkillReferenceInput,
  output: "# Project spans and traces\n\nQuery spans and traces for a project.",
});

// ---------------------------------------------------------------------------
// call_subagent tool mocks
// ---------------------------------------------------------------------------

const callSubagentRunningPart = makePart({
  toolName: "call_subagent",
  state: "input-available",
  input: {
    name: "server",
    task: "Investigate why the GraphQL spans resolver returns duplicate edges.",
  },
});

const callSubagentCompletedPart = makePart({
  toolName: "call_subagent",
  state: "output-available",
  input: {
    name: "server",
    task: "Investigate why the GraphQL spans resolver returns duplicate edges.",
  },
  output:
    "The duplicate edges come from a missing DISTINCT clause in the spans dataloader join. Adding `.distinct()` to the SQLAlchemy query before pagination resolves it.",
});

const callSubagentErrorPart = makePart({
  toolName: "call_subagent",
  state: "output-error",
  input: {
    name: "unknown-agent",
    task: "Do something with an agent that does not exist.",
  },
  errorText: "Subagent 'unknown-agent' is not registered.",
});

// ---------------------------------------------------------------------------
// execute_browser_action tool mocks
// ---------------------------------------------------------------------------

const executeBrowserActionScript = [
  "const before = await ui.playground.prompt.read({ instanceId: 0 });",
  "if (!before.ok) return before;",
  "log(`editing revision ${before.output.revision}`);",
  "return await ui.playground.prompt.edit({",
  "  instanceId: 0,",
  "  expectedRevision: before.output.revision,",
  "  operations: [",
  "    {",
  '      type: "update_message",',
  "      messageId: 7,",
  '      content: "You are a terse expert coding assistant.",',
  "    },",
  "  ],",
  "});",
].join("\n");

/**
 * The script edits the prompt, so it carries a `write_description`: the
 * model-authored approval prompt the user accepts or rejects in manual edit
 * mode before the script runs.
 */
const executeBrowserActionInput = {
  summary: "Tighten the system prompt on playground instance A.",
  script: executeBrowserActionScript,
  write_description:
    'This script will replace the system prompt on playground instance A with "You are a terse expert coding assistant."',
};

const executeBrowserActionAwaitingApprovalToolCallId =
  "execute-ui-awaiting-approval";

const executeBrowserActionAwaitingApprovalPart = makePart({
  toolName: EXECUTE_BROWSER_ACTION_TOOL_NAME,
  toolCallId: executeBrowserActionAwaitingApprovalToolCallId,
  state: "input-available",
  input: executeBrowserActionInput,
});

const executeBrowserActionRunningPart = makePart({
  toolName: EXECUTE_BROWSER_ACTION_TOOL_NAME,
  toolCallId: "execute-ui-running",
  state: "input-available",
  input: executeBrowserActionInput,
});

const executeBrowserActionCompletedPart = makePart({
  toolName: EXECUTE_BROWSER_ACTION_TOOL_NAME,
  toolCallId: "execute-ui-completed",
  state: "output-available",
  input: executeBrowserActionInput,
  output: [
    "Script completed after 2 ui calls.",
    "Calls:\n1. playground.prompt.read ok 6ms 418ch\n2. playground.prompt.edit ok 41ms 187ch",
    "Logs:\nediting revision prompt-d2f07c04",
    // Under the approved script, the edit applies without a card of its own,
    // so it reports `acceptedBy: "auto"`.
    'Return value:\n{\n  "ok": true,\n  "output": {\n    "status": "accepted",\n    "acceptedBy": "auto",\n    "instanceId": 0,\n    "revision": "prompt-a81f22c9",\n    "message": "Prompt edit applied."\n  }\n}',
  ].join("\n\n"),
});

const executeBrowserActionRejectedPart = makePart({
  toolName: EXECUTE_BROWSER_ACTION_TOOL_NAME,
  toolCallId: "execute-ui-rejected",
  state: "output-available",
  input: executeBrowserActionInput,
  output: SCRIPT_REJECTED_OUTPUT,
});

const executeBrowserActionInterruptedPart = makePart({
  toolName: EXECUTE_BROWSER_ACTION_TOOL_NAME,
  toolCallId: "execute-ui-interrupted",
  state: "output-error",
  input: executeBrowserActionInput,
  errorText: "The script run was interrupted.",
});

const executeBrowserActionStreamingPart = makePart({
  toolName: EXECUTE_BROWSER_ACTION_TOOL_NAME,
  toolCallId: "execute-ui-streaming",
  state: "input-streaming",
  input: {
    summary: "Tighten the system prompt on playground instance A.",
    script: "const before = await ui.playground.prompt.read({ inst",
  },
});

// ---------------------------------------------------------------------------
// search_browser_actions tool mocks
//
// search_browser_actions returns a `.d.ts`-style catalog *string* (signatures + doc
// comments). SearchUIToolDetails renders it verbatim as a highlighted code
// file inside the collapsing section, instead of the generic renderer's
// JSON.stringify (which would escape the whole thing onto one line).
//
// The catalog is produced by the same production calls the tool makes, so it
// is the complete operation catalog in its current format. The store mounts
// the playground prompt operations, standing in for a user on the Prompt
// Playground; every other operation reports where it becomes available.
// ---------------------------------------------------------------------------

function searchUICatalogFixture(query: string): string {
  const store = createAgentStore();
  for (const operation of playgroundPromptOperations) {
    store
      .getState()
      .registerClientAction(operation.name, async () => ({ ok: true }));
  }
  return renderUIOperationCatalog(
    searchUIOperations({ agentStore: store, query })
  );
}

const searchUIQuery = "playground prompt";

const searchUIResultsPart = makePart({
  toolName: SEARCH_BROWSER_ACTIONS_TOOL_NAME,
  toolCallId: "search-ui-results",
  state: "output-available",
  input: { query: searchUIQuery },
  output: searchUICatalogFixture(searchUIQuery),
});

const searchUIRunningPart = makePart({
  toolName: SEARCH_BROWSER_ACTIONS_TOOL_NAME,
  toolCallId: "search-ui-running",
  state: "input-available",
  input: { query: "evaluator" },
});

// ---------------------------------------------------------------------------
// Dataset write approvals (DatasetWriteApprovalCard)
//
// The older, dedicated approval-card path. Note the structured action label
// per kind and the danger note on every destructive (`delete-*`) kind — the
// polish the execute_browser_action summary path does not currently reproduce.
// ---------------------------------------------------------------------------

function datasetWritePart(toolName: string, toolCallId: string) {
  return makePart({
    toolName,
    toolCallId,
    state: "input-available",
    input: {},
  });
}

/** A dataset-write state: the tool call plus the pending write it staged. */
function datasetWriteState(
  label: string,
  toolName: string,
  toolCallId: string,
  preview: PendingDatasetWrite["preview"],
  description?: string
): ToolPartState {
  return {
    label,
    description,
    part: datasetWritePart(toolName, toolCallId),
    setupStore: (store) => {
      store.getState().setPendingDatasetWrite(toolCallId, {
        toolCallId,
        toolName,
        preview,
        accept: async () => undefined,
        reject: async () => undefined,
      });
    },
  };
}

// ---------------------------------------------------------------------------
// ToolPart stories
// ---------------------------------------------------------------------------

/**
 * One tool call in the chat transcript: a collapsible row with the tool's
 * name, a preview of its input and its status, which expands into a body the
 * tool owns. Most tools have a bespoke body; tools without one fall back to
 * pretty-printed input and output. A call that stages a change for the user
 * to accept renders its approval card in the body and opens automatically.
 *
 * Each story is one tool family, stacking that family's states in the order
 * the tool reaches them. `bash` runs preparing, running, awaiting approval,
 * completed, denied, error; `execute_browser_action` asks before running, so
 * it runs preparing, awaiting approval, running, completed, rejected,
 * interrupted. Families with several kinds of call (documentation, skills)
 * stack each kind's states in turn, and the write
 * families show each write awaiting approval. Every state renders against its own agent store, so a pending approval
 * staged for one state never leaks into another.
 */

const toolPartMeta = {
  title: "Domains/PXI/Tool Part",
  tags: ["updated", "unreviewed", "incomplete"],
  component: ToolPart,
  // Rolldown can emit one-character helper exports in this large story module.
  excludeStories: /^[A-Za-z_$]$/,
  decorators: [
    (Story) => (
      <div css={containerCSS}>
        <Story />
      </div>
    ),
  ],
  parameters: {
    controls: { disable: true },
    contentMaxWidth: 780,
    contentMode: "bounded",
    layout: "padded",
    themeLayout: "column",
  },
} satisfies Meta<typeof ToolPart>;

export default toolPartMeta;

type Story = StoryObj;

/**
 * `bash` calls from input to result. The approval states are bash calls too:
 * a command the agent must ask before running renders its approval request
 * in the bash body, and a denied one keeps the command visible.
 */
export const Bash: Story = {
  render: () => (
    <ToolPartStates
      states={[
        { label: "Preparing", part: bashStreamingPart },
        { label: "Running", part: bashRunningPart },
        { label: "Awaiting approval", part: approvalRequestedPart },
        {
          label: "Completed",
          description: "Stdout from a successful command.",
          part: bashCompletedPart,
        },
        {
          label: "Completed, multi-line command",
          part: bashMultilineCommandPart,
        },
        {
          label: "Denied",
          description: "The user declined a destructive command.",
          part: deniedPart,
        },
        { label: "Error", part: bashErrorPart },
      ]}
    />
  ),
};

/**
 * Tools without a bespoke body, such as `read` and `edit`, fall back to
 * pretty-printed JSON input and output.
 */
export const GenericTools: Story = {
  render: () => (
    <ToolPartStates
      states={[
        { label: "Read, completed", part: readPart },
        { label: "Edit, completed", part: editPart },
      ]}
    />
  ),
};

/**
 * `ask_user` pauses the agent on questions for the user. The pending states
 * show the question carousel; the answered and skipped states show the
 * recorded answers; the errors come from three different origins.
 */
export const AskUser: Story = {
  render: () => (
    <ToolPartStates
      states={[
        { label: "Awaiting answers", part: askUserAwaitingPart },
        {
          label: "Draft in progress",
          description:
            "The first question is answered and the second is current.",
          part: askUserDraftInProgressPart,
          elicitationDraft: askUserDraftInProgress,
        },
        {
          label: "Custom answer selected but blank",
          part: askUserBlankCustomPart,
          elicitationDraft: askUserBlankCustomDraft,
        },
        { label: "Answered", part: askUserAnsweredPart },
        { label: "Skipped", part: askUserSkippedPart },
        {
          label: "Error: invalid input",
          description: (
            <>
              The tool registry emits an <code>output-error</code> result when{" "}
              <code>ask_user</code> input fails schema parsing, such as an empty{" "}
              <code>questions</code> array.
            </>
          ),
          part: askUserInvalidInputPart,
        },
        {
          label: "Error: cancelled by the user",
          description: (
            <>
              The chat writes back an <code>output-error</code> result when the
              user cancels the question carousel.
            </>
          ),
          part: askUserCancelledPart,
        },
        {
          label: "Error: could not resume",
          description:
            "Representable but not emitted by production today: a recovery error for a question left unresolved when the conversation is reopened, once its pending state cannot be reconstructed.",
          part: askUserResumeFailedPart,
        },
      ]}
    />
  ),
};

// Not `Docs`: that export's id would collide with the autodocs page's id,
// and the index would silently drop the story.
/** The documentation tools: search and file-system queries over the docs. */
export const Documentation: Story = {
  render: () => (
    <ToolPartStates
      states={[
        { label: "Search, running", part: docsSearchRunningPart },
        { label: "Search, completed", part: docsSearchPart },
        {
          label: "File-system query, running",
          part: docsFileSystemQueryRunningPart,
        },
        {
          label: "File-system query, completed",
          part: docsFileSystemQueryPart,
        },
      ]}
    />
  ),
};

/**
 * `load_skill` and `load_skill_reference`. While running or failed they use
 * the standard chrome; once completed they switch to the quiet variant — a
 * subdued "Loaded skill …" label when collapsed, and a left-border body like
 * a tool group when expanded.
 */
export const LoadSkill: Story = {
  render: () => (
    <ToolPartStates
      states={[
        { label: "Skill, running", part: loadSkillRunningPart },
        {
          label: "Skill, completed and collapsed",
          part: loadSkillCompletedPart,
          defaultOpen: false,
        },
        {
          label: "Skill, completed and expanded",
          part: loadSkillCompletedPart,
        },
        { label: "Skill, error", part: loadSkillErrorPart },
        {
          label: "Reference, running",
          part: makePart({
            toolName: "load_skill_reference",
            state: "input-available",
            input: loadSkillReferenceInput,
          }),
        },
        {
          label: "Reference, completed and collapsed",
          part: loadSkillReferenceCompletedPart,
          defaultOpen: false,
        },
        {
          label: "Reference, completed and expanded",
          part: loadSkillReferenceCompletedPart,
        },
        {
          label: "Reference, error",
          part: makePart({
            toolName: "load_skill_reference",
            state: "output-error",
            input: loadSkillReferenceInput,
            errorText: "Reference not found in the skill registry.",
          }),
        },
      ]}
    />
  ),
};

/** `call_subagent` delegating a task; the collapsed preview is the subagent's name. */
export const CallSubagent: Story = {
  render: () => (
    <ToolPartStates
      states={[
        { label: "Running", part: callSubagentRunningPart },
        { label: "Completed", part: callSubagentCompletedPart },
        {
          label: "Error: subagent not registered",
          part: callSubagentErrorPart,
        },
      ]}
    />
  ),
};

/**
 * `execute_browser_action` runs a script of `ui.*` calls. A script that
 * changes state carries a `write_description`, and in manual edit mode the
 * user accepts or rejects the whole script once, before it runs; accepting
 * covers every state-changing call in it, with no card per call.
 */
export const ExecuteBrowserAction: Story = {
  render: () => (
    <ToolPartStates
      states={[
        {
          label: "Preparing",
          description: "The summary and script are still streaming in.",
          part: executeBrowserActionStreamingPart,
        },
        {
          label: "Awaiting approval",
          description:
            "The approval card shows the script's write description. Nothing has run yet.",
          part: executeBrowserActionAwaitingApprovalPart,
          setupStore: (store) => {
            store
              .getState()
              .setPendingScriptApproval(
                executeBrowserActionAwaitingApprovalToolCallId,
                {
                  toolCallId: executeBrowserActionAwaitingApprovalToolCallId,
                  description: executeBrowserActionInput.write_description,
                  accept: async () => undefined,
                  reject: async () => undefined,
                }
              );
          },
        },
        {
          label: "Running",
          description:
            "After the user accepts, or in bypass mode, the script runs and its changes apply without further approval.",
          part: executeBrowserActionRunningPart,
        },
        {
          label: "Completed",
          description: "The script's result and return value.",
          part: executeBrowserActionCompletedPart,
        },
        {
          label: "Rejected",
          description:
            "The user rejected the script, so it never ran. The rejection is the tool's result, not an error.",
          part: executeBrowserActionRejectedPart,
        },
        {
          label: "Interrupted",
          description:
            "Stopping the chat ends a script that is awaiting approval or running.",
          part: executeBrowserActionInterruptedPart,
        },
      ]}
    />
  ),
};

/**
 * `search_browser_actions` returns the complete `.d.ts`-style catalog of
 * `ui.*` calls, query matches first, rendered as a highlighted code file.
 * Each call is marked read or write and says whether it is available on the
 * current page.
 */
export const SearchBrowserActions: Story = {
  render: () => (
    <ToolPartStates
      states={[
        {
          label: "Running",
          description: "The query shows in the collapsed preview.",
          part: searchUIRunningPart,
        },
        { label: "Completed", part: searchUIResultsPart },
      ]}
    />
  ),
};

/**
 * Dataset writes awaiting approval, on the dedicated dataset approval card.
 * Each kind has its own structured action label, and every destructive
 * (`delete-*`) kind carries a danger note.
 */
export const DatasetWrites: Story = {
  render: () => (
    <ToolPartStates
      states={[
        datasetWriteState(
          "Create dataset",
          CREATE_DATASET_TOOL_NAME,
          "dw-create",
          {
            kind: "create",
            name: "support-conversations",
            description: "Curated support chats for regression testing.",
            examples: [
              {
                input: { question: "How do I reset my password?" },
                output: {
                  answer: "Open Settings > Security > Reset password.",
                },
              },
            ],
          }
        ),
        datasetWriteState(
          "Add examples",
          ADD_DATASET_EXAMPLES_TOOL_NAME,
          "dw-add",
          {
            kind: "add",
            examples: [
              {
                input: { question: "Where are my invoices?" },
                output: { answer: "Billing > Invoices." },
                metadata: { source: "zendesk" },
              },
            ],
          }
        ),
        datasetWriteState(
          "Add spans",
          ADD_SPANS_TO_DATASET_TOOL_NAME,
          "dw-add-spans",
          {
            kind: "add-spans",
            datasetName: "support-conversations",
            spanCount: 12,
          }
        ),
        datasetWriteState(
          "Create split",
          CREATE_DATASET_SPLIT_TOOL_NAME,
          "dw-create-split",
          {
            kind: "create-split",
            name: "validation",
            description: "Held-out validation rows.",
            color: "#4CAF50",
            exampleCount: 42,
          }
        ),
        datasetWriteState(
          "Set example splits",
          SET_DATASET_EXAMPLE_SPLITS_TOOL_NAME,
          "dw-set-splits",
          {
            kind: "set-splits",
            datasetName: "support-conversations",
            splitNames: ["validation", "hard-cases"],
            exampleIds: ["RXhhbXBsZTox", "RXhhbXBsZToy", "RXhhbXBsZToz"],
          }
        ),
        datasetWriteState(
          "Create label",
          CREATE_DATASET_LABEL_TOOL_NAME,
          "dw-create-label",
          {
            kind: "create-label",
            name: "needs-review",
            description: "Rows a human should double-check.",
            color: "#FF9800",
            attachToDataset: true,
          }
        ),
        datasetWriteState(
          "Set labels",
          SET_DATASET_LABELS_TOOL_NAME,
          "dw-set-labels",
          { kind: "set-labels", labelNames: ["golden", "needs-review"] }
        ),
        datasetWriteState(
          "Update dataset",
          PATCH_DATASET_TOOL_NAME,
          "dw-patch-dataset",
          {
            kind: "patch-dataset",
            changes: {
              name: "support-conversations-v2",
              description: "Renamed and re-scoped.",
            },
          }
        ),
        datasetWriteState(
          "Update examples",
          PATCH_DATASET_EXAMPLES_TOOL_NAME,
          "dw-patch-examples",
          {
            kind: "patch-examples",
            datasetName: "support-conversations",
            patches: [
              {
                exampleId: "RXhhbXBsZTox",
                output: {
                  answer: "Open Settings > Security > Reset password.",
                },
              },
            ],
          }
        ),
        datasetWriteState(
          "Update split",
          PATCH_DATASET_SPLIT_TOOL_NAME,
          "dw-patch-split",
          {
            kind: "patch-split",
            splitName: "validation",
            changes: { color: "#2196F3" },
          }
        ),
        datasetWriteState(
          "Delete dataset",
          DELETE_DATASET_TOOL_NAME,
          "dw-delete-dataset",
          { kind: "delete-dataset", datasetName: "support-conversations" }
        ),
        datasetWriteState(
          "Delete examples",
          DELETE_DATASET_EXAMPLES_TOOL_NAME,
          "dw-delete-examples",
          {
            kind: "delete-examples",
            datasetName: "support-conversations",
            exampleIds: ["RXhhbXBsZTox", "RXhhbXBsZToy"],
          }
        ),
        datasetWriteState(
          "Delete splits",
          DELETE_DATASET_SPLITS_TOOL_NAME,
          "dw-delete-splits",
          { kind: "delete-splits", splitNames: ["hard-cases"] }
        ),
        datasetWriteState(
          "Delete labels",
          DELETE_DATASET_LABELS_TOOL_NAME,
          "dw-delete-labels",
          { kind: "delete-labels", labelNames: ["needs-review"] }
        ),
      ]}
    />
  ),
};

/**
 * The other writes to Phoenix records that pause for approval: annotation
 * configs, span annotations and experiment metadata. Each has its own
 * approval body.
 */
export const AnnotationAndExperimentWrites: Story = {
  render: () => (
    <ToolPartStates
      states={[
        {
          label: "Create annotation config, awaiting approval",
          part: makePart({
            toolName: CREATE_ANNOTATION_CONFIG_TOOL_NAME,
            toolCallId: "ac-create",
            state: "input-available",
            input: {},
          }),
          setupStore: (store) => {
            store.getState().setPendingAnnotationConfigWrite("ac-create", {
              toolCallId: "ac-create",
              toolName: CREATE_ANNOTATION_CONFIG_TOOL_NAME,
              preview: {
                kind: "create",
                draft: {
                  type: "categorical",
                  name: "helpfulness",
                  description: "Did the answer resolve the user's problem?",
                  optimizationDirection: "MAXIMIZE",
                  values: [
                    { label: "helpful", score: 1 },
                    { label: "partly", score: 0.5 },
                    { label: "unhelpful", score: 0 },
                  ],
                },
                projectId: "UHJvamVjdDox",
              },
              accept: async () => undefined,
              reject: async () => undefined,
            } satisfies PendingAnnotationConfigWrite);
          },
        },
        {
          label: "Update annotation config, awaiting approval",
          description: "Warns that an update replaces the whole config.",
          part: makePart({
            toolName: UPDATE_ANNOTATION_CONFIG_TOOL_NAME,
            toolCallId: "ac-update",
            state: "input-available",
            input: {},
          }),
          setupStore: (store) => {
            store.getState().setPendingAnnotationConfigWrite("ac-update", {
              toolCallId: "ac-update",
              toolName: UPDATE_ANNOTATION_CONFIG_TOOL_NAME,
              preview: {
                kind: "update",
                configId: "QW5ub3RhdGlvbkNvbmZpZzox",
                draft: {
                  type: "continuous",
                  name: "helpfulness",
                  optimizationDirection: "MAXIMIZE",
                  lowerBound: 0,
                  upperBound: 1,
                },
              },
              accept: async () => undefined,
              reject: async () => undefined,
            } satisfies PendingAnnotationConfigWrite);
          },
        },
        {
          label: "Annotate spans, awaiting approval",
          description: "Lists the proposed annotations.",
          part: makePart({
            toolName: BATCH_SPAN_ANNOTATE_TOOL_NAME,
            toolCallId: "bsa-approval",
            state: "input-available",
            input: {
              annotations: [
                {
                  spanId: "abcdef0123456789",
                  name: "helpfulness",
                  label: "helpful",
                  score: 1,
                  explanation: "Directly answered the user's question.",
                  annotatorKind: "LLM",
                },
                {
                  spanId: "0123456789abcdef",
                  name: "grounded",
                  label: "no",
                  score: 0,
                  explanation: "Cited a policy that is not in the reference.",
                  annotatorKind: "LLM",
                },
              ],
            },
          }),
          setupStore: (store) => {
            store.getState().setPendingBatchSpanAnnotate("bsa-approval", {
              toolCallId: "bsa-approval",
              sessionId: "session-annotation-demo",
              annotations: [
                {
                  spanId: "abcdef0123456789",
                  name: "helpfulness",
                  annotatorKind: "LLM",
                  label: "helpful",
                  score: 1,
                  explanation: "Directly answered the user's question.",
                  identifier: null,
                  metadata: null,
                },
                {
                  spanId: "0123456789abcdef",
                  name: "grounded",
                  annotatorKind: "LLM",
                  label: "no",
                  score: 0,
                  explanation: "Cited a policy that is not in the reference.",
                  identifier: null,
                  metadata: null,
                },
              ],
              accept: async () => undefined,
              reject: async () => undefined,
            } satisfies PendingBatchSpanAnnotate);
          },
        },
        {
          label: "Update experiment, awaiting approval",
          description: "Shows a before-and-after diff per changed field.",
          part: makePart({
            toolName: PATCH_EXPERIMENT_TOOL_NAME,
            toolCallId: "px-patch",
            state: "input-available",
            input: {},
          }),
          setupStore: (store) => {
            store.getState().setPendingPatchExperiment("px-patch", {
              toolCallId: "px-patch",
              sessionId: "session-experiment-demo",
              experimentId: "RXhwZXJpbWVudDox",
              experimentName: "router-v3",
              expectedUpdatedAt: "2026-08-11T00:00:00Z",
              payload: {
                name: "router-v3-tuned",
                description: "Tuned routing thresholds after error analysis.",
              },
              diff: [
                {
                  field: "name",
                  previous: "router-v3",
                  next: "router-v3-tuned",
                },
                {
                  field: "description",
                  previous: null,
                  next: "Tuned routing thresholds after error analysis.",
                },
              ],
              accept: async () => undefined,
              reject: async () => undefined,
            } satisfies PendingPatchExperiment);
          },
        },
      ]}
    />
  ),
};

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: Story = {
  tags: ["!dev", "!autodocs"],
  // An expanded tool call at the chat panel's width, shrunk.
  parameters: { thumbnail: { scale: 0.5 } },
  render: () => (
    <AgentStoreStoryProvider>
      <ToolPart part={bashCompletedPart} defaultOpen />
    </AgentStoreStoryProvider>
  ),
};
