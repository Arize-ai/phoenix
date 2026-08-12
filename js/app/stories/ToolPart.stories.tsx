import { css } from "@emotion/react";
import type { Meta, StoryObj } from "@storybook/react";
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
import type {
  CodeEvaluatorDraftSnapshot,
  PendingCodeEvaluatorEdit,
} from "@phoenix/agent/tools/codeEvaluatorDraft";
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
import type {
  LLMEvaluatorDraftSnapshot,
  PendingLlmEvaluatorEdit,
} from "@phoenix/agent/tools/llmEvaluatorDraft";
import {
  PATCH_EXPERIMENT_TOOL_NAME,
  type PendingPatchExperiment,
} from "@phoenix/agent/tools/patchExperiment";
import type { PendingLoadDataset } from "@phoenix/agent/tools/playgroundLoadDataset";
import type {
  PendingPromptEdit,
  PendingPromptInstanceRemoval,
} from "@phoenix/agent/tools/playgroundPrompt";
import type { PendingPromptToolWrite } from "@phoenix/agent/tools/playgroundPromptTools";
import {
  SAVE_PROMPT_TOOL_NAME,
  type PendingSavePrompt,
} from "@phoenix/agent/tools/playgroundSavePrompt";
import { ADD_SPANS_TO_DATASET_TOOL_NAME } from "@phoenix/agent/tools/spansToDataset";
import { EXECUTE_UI_TOOL_NAME } from "@phoenix/agent/uiOperations/executeUiAgentTool";
import {
  ElicitationDraftProvider,
  type PendingElicitationDraft,
} from "@phoenix/components/agent/ElicitationDraftContext";
import {
  ToolPart,
  type ToolPartType,
} from "@phoenix/components/agent/ToolPart";
import { AgentContext } from "@phoenix/contexts/AgentContext";
import { createAgentStore } from "@phoenix/store/agentStore";

const containerCSS = css`
  max-width: 780px;
  width: 100%;
`;

const storyNoteCSS = css`
  margin-bottom: var(--global-dimension-size-200);
  padding: var(--global-dimension-size-150);
  border: 1px solid var(--global-color-gray-300);
  border-radius: var(--global-rounding-small);
  background: var(--global-color-gray-100);
  color: var(--global-text-color-900);
  font-size: 12px;
  line-height: 1.5;

  strong {
    display: block;
    margin-bottom: var(--global-dimension-size-50);
    font-weight: 600;
  }
`;

function withElicitationDraft(draft: PendingElicitationDraft) {
  return (Story: () => React.ReactNode) => (
    <ElicitationDraftProvider draft={draft}>
      <Story />
    </ElicitationDraftProvider>
  );
}

function AgentStoreStoryProvider({
  children,
  pendingSave,
  setupStore,
}: {
  children: React.ReactNode;
  pendingSave?: PendingSavePrompt;
  /** Escape hatch for staging arbitrary pending state on the story's store. */
  setupStore?: (store: ReturnType<typeof createAgentStore>) => void;
}) {
  const [store] = useState(() => {
    const store = createAgentStore();
    if (pendingSave) {
      store
        .getState()
        .setPendingSavePrompt(pendingSave.toolCallId, pendingSave);
    }
    setupStore?.(store);
    return store;
  });

  return (
    <AgentContext.Provider value={store}>{children}</AgentContext.Provider>
  );
}

function withAgentStore(pendingSave?: PendingSavePrompt) {
  return (Story: () => React.ReactNode) => (
    <AgentStoreStoryProvider pendingSave={pendingSave}>
      <Story />
    </AgentStoreStoryProvider>
  );
}

function withAgentStoreSetup(
  setupStore: (store: ReturnType<typeof createAgentStore>) => void
) {
  return (Story: () => React.ReactNode) => (
    <AgentStoreStoryProvider setupStore={setupStore}>
      <Story />
    </AgentStoreStoryProvider>
  );
}

function ToolPartStoryNote({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div css={storyNoteCSS}>
      <strong>{title}</strong>
      <div>{children}</div>
    </div>
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

// ---------------------------------------------------------------------------
// Save prompt tool mocks
// ---------------------------------------------------------------------------

const savePromptApprovalInput = {
  instanceId: 0,
  description:
    "Tighten routing instructions so billing questions go to the payments specialist.",
  tags: ["staging"],
};

const savePromptAwaitingApprovalPart = makePart({
  toolName: SAVE_PROMPT_TOOL_NAME,
  toolCallId: "save-prompt-approval-update",
  state: "input-available",
  input: savePromptApprovalInput,
});

const pendingSavePromptApproval = {
  toolCallId: "save-prompt-approval-update",
  sessionId: "session-playground-demo",
  input: savePromptApprovalInput,
  preview: {
    mode: "update",
    instanceId: 0,
    label: "Customer support router",
    promptId: "UHJvbXB0OjEyMw",
    promptName: "support_router",
    description: savePromptApprovalInput.description,
    tags: savePromptApprovalInput.tags,
    dirtyBeforeSave: true,
  },
  accept: async () => undefined,
  reject: async () => undefined,
} satisfies PendingSavePrompt;

const savePromptCreateInput = {
  instanceId: 1,
  name: "refund_policy_assistant",
  description: "Capture the refund-policy answer pattern from the playground.",
  tags: ["candidate", "qa"],
};

const savePromptCreateApprovalPart = makePart({
  toolName: SAVE_PROMPT_TOOL_NAME,
  toolCallId: "save-prompt-approval-create",
  state: "input-available",
  input: savePromptCreateInput,
});

const pendingSavePromptCreateApproval = {
  toolCallId: "save-prompt-approval-create",
  sessionId: "session-playground-demo",
  input: savePromptCreateInput,
  preview: {
    mode: "create",
    instanceId: 1,
    label: "Refund policy draft",
    promptId: null,
    promptName: "refund_policy_assistant",
    description: savePromptCreateInput.description,
    tags: savePromptCreateInput.tags,
    dirtyBeforeSave: true,
  },
  accept: async () => undefined,
  reject: async () => undefined,
} satisfies PendingSavePrompt;

const savePromptAcceptedPart = makePart({
  toolName: SAVE_PROMPT_TOOL_NAME,
  toolCallId: "save-prompt-accepted",
  state: "output-available",
  input: savePromptApprovalInput,
  output: {
    status: "saved",
    mode: "update",
    instanceId: 0,
    label: "Customer support router",
    promptId: "UHJvbXB0OjEyMw",
    promptName: "support_router",
    promptVersionId: "UHJvbXB0VmVyc2lvbjo0NTY",
    tag: "staging",
    dirtyBeforeSave: true,
    approvalStatus: "accepted",
    acceptedBy: "user",
    message: "New prompt version saved from playground instance.",
  },
});

const savePromptCreatedAutoApprovedPart = makePart({
  toolName: SAVE_PROMPT_TOOL_NAME,
  toolCallId: "save-prompt-created-auto-approved",
  state: "output-available",
  input: savePromptCreateInput,
  output: {
    status: "saved",
    mode: "create",
    instanceId: 1,
    label: "Refund policy draft",
    promptId: "UHJvbXB0Ojc4OQ",
    promptName: "refund_policy_assistant",
    promptVersionId: "UHJvbXB0VmVyc2lvbjo3OTA",
    tag: "candidate",
    dirtyBeforeSave: true,
    approvalStatus: "accepted",
    acceptedBy: "auto",
    message: "Prompt created from playground instance.",
  },
});

const savePromptRejectedPart = makePart({
  toolName: SAVE_PROMPT_TOOL_NAME,
  toolCallId: "save-prompt-rejected",
  state: "output-available",
  input: savePromptApprovalInput,
  output: {
    status: "rejected",
    message: "User rejected the proposed prompt save.",
  },
});

const savePromptErrorPart = makePart({
  toolName: SAVE_PROMPT_TOOL_NAME,
  toolCallId: "save-prompt-error",
  state: "output-error",
  input: {
    instanceId: 3,
    description: "Save the current judge prompt after updating edge cases.",
  },
  errorText:
    "Cannot save prompt because playground instance 3 is no longer mounted.",
});

// ---------------------------------------------------------------------------
// ToolPart stories
// ---------------------------------------------------------------------------

const toolPartMeta = {
  title: "Agent/ToolPart",
  component: ToolPart,
  // Rolldown can emit one-character helper exports in this large story module.
  excludeStories: /^[A-Za-z_$]$/,
  // Open by default so the expanded body is visible; individual stories can
  // override with `defaultOpen: false`.
  args: { defaultOpen: true },
  decorators: [
    (Story) => (
      <div css={containerCSS}>
        <Story />
      </div>
    ),
  ],
  parameters: {
    contentMaxWidth: 780,
    contentMode: "bounded",
    layout: "padded",
  },
} satisfies Meta<typeof ToolPart>;

export default toolPartMeta;

type Story = StoryObj<typeof toolPartMeta>;

/** A bash tool call that completed successfully with stdout output. */
export const BashCompleted: Story = {
  args: { part: bashCompletedPart },
};

/** A bash tool call that errored with an error message. */
export const BashError: Story = {
  args: { part: bashErrorPart },
};

/** A bash tool call currently running (input-available state). */
export const BashRunning: Story = {
  args: { part: bashRunningPart },
};

/** A bash tool call still streaming its input. */
export const BashStreaming: Story = {
  args: { part: bashStreamingPart },
};

/** A bash tool call with a multi-line command. */
export const BashMultilineCommand: Story = {
  args: { part: bashMultilineCommandPart },
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

/** An ask_user tool awaiting the user's response. */
export const AskUserAwaiting: Story = {
  args: { part: askUserAwaitingPart },
};

/** An ask_user tool showing in-progress draft answers and pending questions. */
export const AskUserDraftInProgress: Story = {
  args: { part: askUserDraftInProgressPart },
  decorators: [withElicitationDraft(askUserDraftInProgress)],
};

/** An ask_user tool with answers received. */
export const AskUserAnswered: Story = {
  args: { part: askUserAnsweredPart },
};

/** An ask_user tool with a custom option selected but left blank. */
export const AskUserBlankCustom: Story = {
  args: { part: askUserBlankCustomPart },
  decorators: [withElicitationDraft(askUserBlankCustomDraft)],
};

/** An ask_user tool with a final skipped answer. */
export const AskUserSkipped: Story = {
  args: { part: askUserSkippedPart },
};

/** An ask_user tool that errored because the model emitted invalid input. */
export const AskUserInvalidInput: Story = {
  args: { part: askUserInvalidInputPart },
  render: (args) => (
    <>
      <ToolPartStoryNote title="Origin: Tool Registry Error Path">
        This mirrors the registered tool validation path. The tool registry
        emits an <code>output-error</code> result when <code>ask_user</code>
        input fails schema parsing, such as an empty <code>questions</code>
        array.
      </ToolPartStoryNote>
      <ToolPart {...args} />
    </>
  ),
};

/** An ask_user tool that errored because the user cancelled the prompt. */
export const AskUserCancelled: Story = {
  args: { part: askUserCancelledPart },
  render: (args) => (
    <>
      <ToolPartStoryNote title="Origin: Chat-Side Cancel Flow">
        This comes from the client chat flow, not the registry. When the user
        cancels the elicitation carousel, <code>useAgentChat</code> writes back
        an <code>output-error</code> tool result with the cancellation message.
      </ToolPartStoryNote>
      <ToolPart {...args} />
    </>
  ),
};

/** A simulated ask_user recovery failure after the conversation was reopened. */
export const AskUserResumeFailed: Story = {
  args: { part: askUserResumeFailedPart },
  render: (args) => (
    <>
      <ToolPartStoryNote title="Origin: Representable UI State Only">
        This failure is representable in the UI but is not currently emitted by
        production code. It documents a plausible recovery error if a
        conversation is reopened after an <code>ask_user</code> call was left
        unresolved and the ephemeral pending elicitation state cannot be
        reconstructed.
      </ToolPartStoryNote>
      <ToolPart {...args} />
    </>
  ),
};

/** A docs search tool that completed with results. */
export const DocsSearch: Story = {
  args: { part: docsSearchPart },
};

/** A docs search tool currently running. */
export const DocsSearchRunning: Story = {
  args: { part: docsSearchRunningPart },
};

/** A docs filesystem query tool that returned command output. */
export const DocsFileSystemQuery: Story = {
  args: { part: docsFileSystemQueryPart },
};

/** A docs filesystem query tool currently running. */
export const DocsFileSystemQueryRunning: Story = {
  args: { part: docsFileSystemQueryRunningPart },
};

/** A save_prompt tool waiting for approval before saving a new version. */
export const SavePromptAwaitingApproval: Story = {
  args: { part: savePromptAwaitingApprovalPart },
  decorators: [withAgentStore(pendingSavePromptApproval)],
};

/** A save_prompt tool waiting for approval before creating a new prompt. */
export const SavePromptCreateApproval: Story = {
  args: { part: savePromptCreateApprovalPart },
  decorators: [withAgentStore(pendingSavePromptCreateApproval)],
};

/** A save_prompt tool after the user accepted and a version was saved. */
export const SavePromptAccepted: Story = {
  args: { part: savePromptAcceptedPart },
  decorators: [withAgentStore()],
};

/** A save_prompt tool after bypass mode auto-approved prompt creation. */
export const SavePromptCreatedAutoApproved: Story = {
  args: { part: savePromptCreatedAutoApprovedPart },
  decorators: [withAgentStore()],
};

/** A save_prompt tool after the user rejected the proposed save. */
export const SavePromptRejected: Story = {
  args: { part: savePromptRejectedPart },
  decorators: [withAgentStore()],
};

/** A save_prompt tool that failed before a save could be proposed. */
export const SavePromptError: Story = {
  args: { part: savePromptErrorPart },
  decorators: [withAgentStore()],
};

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

/** A load_skill tool currently running (shows standard chrome). */
export const LoadSkillRunning: Story = {
  args: { part: loadSkillRunningPart },
};

/**
 * A completed load_skill tool collapsed (quiet variant).
 * Shows minimal chrome with just "Loaded skill phoenix-frontend" label.
 */
export const LoadSkillCollapsed: Story = {
  args: { part: loadSkillCompletedPart, defaultOpen: false },
  render: (args) => (
    <>
      <ToolPartStoryNote title="Collapsed State">
        When collapsed, the quiet variant shows minimal chrome with a subdued
        label. Click to expand and see the quiet-expanded variant with the
        lefthand border style.
      </ToolPartStoryNote>
      <ToolPart {...args} />
    </>
  ),
};

/**
 * A completed load_skill tool expanded (quiet-expanded variant).
 * Shows lefthand line style like tool groups instead of full chrome.
 */
export const LoadSkillExpanded: Story = {
  args: { part: loadSkillCompletedPart },
};

/** A load_skill tool that failed to find the skill. */
export const LoadSkillError: Story = {
  args: { part: loadSkillErrorPart },
};

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

/** A call_subagent tool currently delegating to a subagent (summary = name). */
export const CallSubagentRunning: Story = {
  args: { part: callSubagentRunningPart },
};

/** A call_subagent tool that completed with the subagent's result. */
export const CallSubagentCompleted: Story = {
  args: { part: callSubagentCompletedPart },
};

/** A call_subagent tool that failed because the subagent was not found. */
export const CallSubagentError: Story = {
  args: { part: callSubagentErrorPart },
};

// ---------------------------------------------------------------------------
// execute_ui tool mocks
// ---------------------------------------------------------------------------

const executeUiScript = [
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

const executeUiInput = {
  summary: "Tighten the system prompt on playground instance A.",
  script: executeUiScript,
};

function promptSnapshotFixture(content: string) {
  return {
    instanceId: 0,
    index: 0,
    label: "A",
    revision: "prompt-d2f07c04",
    dirty: false,
    prompt: null,
    messages: [
      { id: 7, role: "system" as const, content },
      { id: 8, role: "user" as const, content: "{{question}}" },
    ],
  };
}

const executeUiAwaitingApprovalPart = makePart({
  toolName: EXECUTE_UI_TOOL_NAME,
  toolCallId: "execute-ui-prompt-edit",
  state: "input-available",
  input: executeUiInput,
});

const executeUiPendingPromptEdit: PendingPromptEdit = {
  // Inner operation call id: `<toolCallId>:<sequence>`.
  toolCallId: "execute-ui-prompt-edit:1",
  sessionId: "session-playground-demo",
  instanceId: 0,
  expectedRevision: "prompt-d2f07c04",
  before: promptSnapshotFixture(
    "You are an expert coding assistant. Help users design, write, debug, explain, and improve software with accurate, practical guidance."
  ),
  after: promptSnapshotFixture("You are a terse expert coding assistant."),
  operations: [],
  accept: async () => undefined,
  reject: async () => undefined,
};

const executeUiCompletedPart = makePart({
  toolName: EXECUTE_UI_TOOL_NAME,
  toolCallId: "execute-ui-completed",
  state: "output-available",
  input: executeUiInput,
  output: [
    "Script completed after 2 ui calls.",
    "Logs:\nediting revision prompt-d2f07c04",
    'Return value:\n{\n  "ok": true,\n  "output": {\n    "status": "accepted",\n    "acceptedBy": "user",\n    "instanceId": 0,\n    "revision": "prompt-a81f22c9",\n    "message": "Prompt edit applied."\n  }\n}',
  ].join("\n\n"),
});

const executeUiStreamingPart = makePart({
  toolName: EXECUTE_UI_TOOL_NAME,
  toolCallId: "execute-ui-streaming",
  state: "input-streaming",
  input: {
    summary: "Tighten the system prompt on playground instance A.",
    script: "const before = await ui.playground.prompt.read({ inst",
  },
});

/**
 * An execute_ui script paused on an inner prompt-edit approval: the
 * syntax-highlighted script above, the proposed change as a unified diff, and
 * the Accept/Reject actions that resolve the awaiting script.
 */
export const ExecuteUiAwaitingPromptEditApproval: Story = {
  args: { part: executeUiAwaitingApprovalPart },
  decorators: [
    withAgentStoreSetup((store) => {
      store
        .getState()
        .setPendingPromptEdit(
          executeUiPendingPromptEdit.toolCallId,
          executeUiPendingPromptEdit
        );
    }),
  ],
};

/** An execute_ui script that completed, showing logs and the return value. */
export const ExecuteUiCompleted: Story = {
  args: { part: executeUiCompletedPart },
  decorators: [withAgentStore()],
};

/** An execute_ui call whose summary and script are still streaming in. */
export const ExecuteUiStreaming: Story = {
  args: { part: executeUiStreamingPart },
  decorators: [withAgentStore()],
};

// ---------------------------------------------------------------------------
// execute_ui inner-operation approvals
//
// Every approval kind an execute_ui script can stage through a `ui.*` call.
// Grouped so the audit can compare them side by side — in particular the split
// between operations that render a rich unified diff (prompt edit above,
// prompt-tool write, evaluator drafts) and those that fall back to a raw-JSON
// `stringifyToolValue` summary (save prompt, load dataset, instance removal)
// now that they run through the meta-tool instead of their bespoke tool card.
// Each inner op is keyed `<executeUiToolCallId>:<sequence>`; the story stages a
// pending entry under that key and `useScriptChildApprovals` picks it up.
// ---------------------------------------------------------------------------

/** An execute_ui host part awaiting one inner-operation approval. */
function executeUiHostPart(
  toolCallId: string,
  summary: string,
  script: string
) {
  return makePart({
    toolName: EXECUTE_UI_TOOL_NAME,
    toolCallId,
    state: "input-available",
    input: { summary, script },
  });
}

function makeCodeEvaluatorSnapshot(
  overrides: Partial<CodeEvaluatorDraftSnapshot> = {}
): CodeEvaluatorDraftSnapshot {
  return {
    mode: "create",
    evaluatorNodeId: null,
    name: "hallucination",
    description: "",
    language: "PYTHON",
    sourceCode: "def evaluate(output):\n    return 1.0",
    sandboxConfigId: "py-sandbox",
    inputMapping: { pathMapping: {}, literalMapping: {} },
    testPayload: {
      input: { question: "Which answer used a tool?" },
      output: { messages: [{ role: "assistant", content: "Used search" }] },
      reference: { expectedTool: "search" },
      metadata: { split: "validation" },
    },
    outputConfigs: [],
    ...overrides,
  };
}

function makeLlmEvaluatorSnapshot(
  overrides: Partial<LLMEvaluatorDraftSnapshot> = {}
): LLMEvaluatorDraftSnapshot {
  return {
    mode: "create",
    evaluatorNodeId: null,
    name: "hallucination",
    description: "",
    inputMapping: { pathMapping: {}, literalMapping: {} },
    testPayload: { input: {}, output: {}, reference: {}, metadata: {} },
    includeExplanation: true,
    outputConfigs: [],
    judge: {
      model: "gpt-4o",
      provider: "OPENAI",
      templateFormat: "MUSTACHE",
      messages: [{ role: "system", content: "Evaluate the output." }],
      invocationParameters: {},
      tools: null,
      toolChoice: null,
    },
    ...overrides,
  };
}

const executeUiSavePromptChild = {
  toolCallId: "execute-ui-save-prompt:1",
  sessionId: "session-playground-demo",
  input: { instanceId: 0, description: "Tighten the routing instructions." },
  preview: {
    mode: "update",
    instanceId: 0,
    label: "Customer support router",
    promptId: "UHJvbXB0OjEyMw",
    promptName: "support_router",
    description: "Tighten the routing instructions.",
    tags: ["staging"],
    dirtyBeforeSave: true,
  },
  accept: async () => undefined,
  reject: async () => undefined,
} satisfies PendingSavePrompt;

/**
 * REGRESSION WATCH: as a standalone tool, save_prompt renders a structured
 * preview (see SavePromptAwaitingApproval). Routed through execute_ui it falls
 * back to `stringifyToolValue(pending.preview)` — a raw JSON dump with no
 * labels or emphasis. Compare the two stories directly.
 */
export const ExecuteUiAwaitingSavePromptApproval: Story = {
  args: {
    part: executeUiHostPart(
      "execute-ui-save-prompt",
      "Save the tightened support-router prompt.",
      "return await ui.playground.savePrompt({ instanceId: 0 });"
    ),
  },
  decorators: [
    withAgentStoreSetup((store) => {
      store
        .getState()
        .setPendingSavePrompt(
          executeUiSavePromptChild.toolCallId,
          executeUiSavePromptChild
        );
    }),
  ],
};

const executeUiLoadDatasetChild = {
  toolCallId: "execute-ui-load-dataset:1",
  sessionId: "session-playground-demo",
  input: { datasetName: "support-conversations", splitName: "validation" },
  snapshot: {
    datasetId: "RGF0YXNldDow",
    splitIds: [],
    datasetName: "(none)",
    splitNames: [],
  },
  expectedSelection: {
    datasetId: "RGF0YXNldDox",
    splitIds: ["U3BsaXQ6MQ"],
  },
  expectedRevision: "dataset-rev-1",
  accept: async () => undefined,
  reject: async () => undefined,
} satisfies PendingLoadDataset;

/**
 * REGRESSION WATCH: load_dataset as a standalone tool has a purpose-built
 * preview (LoadDatasetToolDetails). Through execute_ui it renders
 * `stringifyToolValue(pending.input)` — the raw `{ datasetName, splitName }`.
 */
export const ExecuteUiAwaitingLoadDatasetApproval: Story = {
  args: {
    part: executeUiHostPart(
      "execute-ui-load-dataset",
      "Load the support-conversations validation split.",
      'return await ui.playground.loadDataset({ datasetName: "support-conversations", splitName: "validation" });'
    ),
  },
  decorators: [
    withAgentStoreSetup((store) => {
      store
        .getState()
        .setPendingLoadDataset(
          executeUiLoadDatasetChild.toolCallId,
          executeUiLoadDatasetChild
        );
    }),
  ],
};

const executeUiInstanceRemovalChild = {
  toolCallId: "execute-ui-instance-removal:1",
  sessionId: "session-playground-demo",
  instanceId: 1,
  label: "B",
  accept: async () => undefined,
  reject: async () => undefined,
} satisfies PendingPromptInstanceRemoval;

/** An execute_ui inner op removing a playground prompt instance (summary-only). */
export const ExecuteUiAwaitingInstanceRemovalApproval: Story = {
  args: {
    part: executeUiHostPart(
      "execute-ui-instance-removal",
      "Remove playground prompt instance B.",
      "return await ui.playground.prompt.removeInstance({ instanceId: 1 });"
    ),
  },
  decorators: [
    withAgentStoreSetup((store) => {
      store
        .getState()
        .setPendingPromptInstanceRemoval(
          executeUiInstanceRemovalChild.toolCallId,
          executeUiInstanceRemovalChild
        );
    }),
  ],
};

const executeUiPromptToolWriteChild = {
  toolCallId: "execute-ui-prompt-tools:1",
  sessionId: "session-playground-demo",
  instanceId: 0,
  expectedRevision: "prompt-d2f07c04",
  provider: "OPENAI",
  input: {
    instanceId: 0,
    expectedRevision: "prompt-d2f07c04",
    tools: [
      {
        name: "get_weather",
        description: "Look up the current weather for a city.",
        parameters: {
          type: "object",
          properties: { city: { type: "string" } },
          required: ["city"],
        },
      },
    ],
  },
  before: { instanceId: 0, index: 0, label: "A", entries: [] },
  after: {
    instanceId: 0,
    index: 0,
    label: "A",
    entries: [
      {
        id: 1,
        name: "get_weather",
        text: '{\n  "description": "Look up the current weather for a city.",\n  "parameters": {\n    "type": "object",\n    "properties": { "city": { "type": "string" } },\n    "required": ["city"]\n  }\n}',
      },
    ],
  },
  summary: {
    instanceIndex: 0,
    instanceLabel: "A",
    created: ["get_weather"],
    updated: [],
    deleted: [],
  },
  accept: async () => undefined,
  reject: async () => undefined,
} satisfies PendingPromptToolWrite;

/** An execute_ui inner op writing playground prompt tools (renders a diff). */
export const ExecuteUiAwaitingPromptToolWriteApproval: Story = {
  args: {
    part: executeUiHostPart(
      "execute-ui-prompt-tools",
      "Add a get_weather tool to playground instance A.",
      "return await ui.playground.promptTools.write({ instanceId: 0, tools: [ /* ... */ ] });"
    ),
  },
  decorators: [
    withAgentStoreSetup((store) => {
      store
        .getState()
        .setPendingPromptToolWrite(
          executeUiPromptToolWriteChild.toolCallId,
          executeUiPromptToolWriteChild
        );
    }),
  ],
};

const executeUiCodeEvaluatorChild = {
  toolCallId: "execute-ui-code-eval:1",
  sessionId: "session-playground-demo",
  before: makeCodeEvaluatorSnapshot(),
  after: makeCodeEvaluatorSnapshot({
    sourceCode:
      "def evaluate(output, reference):\n    used = reference['expectedTool'] in output['messages'][0]['content']\n    return 1.0 if used else 0.0",
  }),
  operations: [],
  accept: async () => undefined,
  reject: async () => undefined,
} satisfies PendingCodeEvaluatorEdit;

/** An execute_ui inner op editing a code-evaluator draft (renders a diff). */
export const ExecuteUiAwaitingCodeEvaluatorEditApproval: Story = {
  args: {
    part: executeUiHostPart(
      "execute-ui-code-eval",
      "Rewrite the hallucination evaluator to check tool usage.",
      "return await ui.evaluators.code.edit({ operations: [ /* ... */ ] });"
    ),
  },
  decorators: [
    withAgentStoreSetup((store) => {
      store
        .getState()
        .setPendingCodeEvaluatorEdit(
          executeUiCodeEvaluatorChild.toolCallId,
          executeUiCodeEvaluatorChild
        );
    }),
  ],
};

const executeUiLlmEvaluatorChild = {
  toolCallId: "execute-ui-llm-eval:1",
  sessionId: "session-playground-demo",
  before: makeLlmEvaluatorSnapshot(),
  after: makeLlmEvaluatorSnapshot({
    judge: {
      model: "gpt-4o",
      provider: "OPENAI",
      templateFormat: "MUSTACHE",
      messages: [
        {
          role: "system",
          content:
            "Grade whether the answer is grounded in the provided reference. Reply with a label.",
        },
      ],
      invocationParameters: {},
      tools: null,
      toolChoice: null,
    },
  }),
  operations: [],
  accept: async () => undefined,
  reject: async () => undefined,
} satisfies PendingLlmEvaluatorEdit;

/** An execute_ui inner op editing an LLM-evaluator draft (renders a diff). */
export const ExecuteUiAwaitingLlmEvaluatorEditApproval: Story = {
  args: {
    part: executeUiHostPart(
      "execute-ui-llm-eval",
      "Sharpen the LLM judge system prompt.",
      "return await ui.evaluators.llm.edit({ operations: [ /* ... */ ] });"
    ),
  },
  decorators: [
    withAgentStoreSetup((store) => {
      store
        .getState()
        .setPendingLlmEvaluatorEdit(
          executeUiLlmEvaluatorChild.toolCallId,
          executeUiLlmEvaluatorChild
        );
    }),
  ],
};

// ---------------------------------------------------------------------------
// Dataset write approvals (DatasetWriteApprovalCard)
//
// The older, dedicated approval-card path. Note the structured action label
// per kind and the danger note on every destructive (`delete-*`) kind — the
// polish the execute_ui summary path does not currently reproduce.
// ---------------------------------------------------------------------------

function datasetWritePart(toolName: string, toolCallId: string) {
  return makePart({
    toolName,
    toolCallId,
    state: "input-available",
    input: {},
  });
}

/** Build a dataset-write story that stages one pending write for review. */
function datasetWriteStory(
  toolName: string,
  toolCallId: string,
  preview: PendingDatasetWrite["preview"]
): Story {
  return {
    args: { part: datasetWritePart(toolName, toolCallId) },
    decorators: [
      withAgentStoreSetup((store) => {
        store.getState().setPendingDatasetWrite(toolCallId, {
          toolCallId,
          toolName,
          preview,
          accept: async () => undefined,
          reject: async () => undefined,
        });
      }),
    ],
  };
}

/** create_dataset awaiting approval. */
export const DatasetWriteCreate: Story = datasetWriteStory(
  CREATE_DATASET_TOOL_NAME,
  "dw-create",
  {
    kind: "create",
    name: "support-conversations",
    description: "Curated support chats for regression testing.",
    examples: [
      {
        input: { question: "How do I reset my password?" },
        output: { answer: "Open Settings > Security > Reset password." },
      },
    ],
  }
);

/** add_dataset_examples awaiting approval. */
export const DatasetWriteAddExamples: Story = datasetWriteStory(
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
);

/** create_dataset_split awaiting approval. */
export const DatasetWriteCreateSplit: Story = datasetWriteStory(
  CREATE_DATASET_SPLIT_TOOL_NAME,
  "dw-create-split",
  {
    kind: "create-split",
    name: "validation",
    description: "Held-out validation rows.",
    color: "#4CAF50",
    exampleCount: 42,
  }
);

/** set_dataset_example_splits awaiting approval. */
export const DatasetWriteSetSplits: Story = datasetWriteStory(
  SET_DATASET_EXAMPLE_SPLITS_TOOL_NAME,
  "dw-set-splits",
  {
    kind: "set-splits",
    datasetName: "support-conversations",
    splitNames: ["validation", "hard-cases"],
    exampleIds: ["RXhhbXBsZTox", "RXhhbXBsZToy", "RXhhbXBsZToz"],
  }
);

/** create_dataset_label awaiting approval. */
export const DatasetWriteCreateLabel: Story = datasetWriteStory(
  CREATE_DATASET_LABEL_TOOL_NAME,
  "dw-create-label",
  {
    kind: "create-label",
    name: "needs-review",
    description: "Rows a human should double-check.",
    color: "#FF9800",
    attachToDataset: true,
  }
);

/** set_dataset_labels awaiting approval. */
export const DatasetWriteSetLabels: Story = datasetWriteStory(
  SET_DATASET_LABELS_TOOL_NAME,
  "dw-set-labels",
  { kind: "set-labels", labelNames: ["golden", "needs-review"] }
);

/** patch_dataset awaiting approval. */
export const DatasetWritePatchDataset: Story = datasetWriteStory(
  PATCH_DATASET_TOOL_NAME,
  "dw-patch-dataset",
  {
    kind: "patch-dataset",
    changes: {
      name: "support-conversations-v2",
      description: "Renamed and re-scoped.",
    },
  }
);

/** patch_dataset_examples awaiting approval. */
export const DatasetWritePatchExamples: Story = datasetWriteStory(
  PATCH_DATASET_EXAMPLES_TOOL_NAME,
  "dw-patch-examples",
  {
    kind: "patch-examples",
    datasetName: "support-conversations",
    patches: [
      {
        exampleId: "RXhhbXBsZTox",
        output: { answer: "Open Settings > Security > Reset password." },
      },
    ],
  }
);

/** patch_dataset_split awaiting approval. */
export const DatasetWritePatchSplit: Story = datasetWriteStory(
  PATCH_DATASET_SPLIT_TOOL_NAME,
  "dw-patch-split",
  {
    kind: "patch-split",
    splitName: "validation",
    changes: { color: "#2196F3" },
  }
);

/** add_spans_to_dataset awaiting approval. */
export const DatasetWriteAddSpans: Story = datasetWriteStory(
  ADD_SPANS_TO_DATASET_TOOL_NAME,
  "dw-add-spans",
  { kind: "add-spans", datasetName: "support-conversations", spanCount: 12 }
);

/** delete_dataset awaiting approval — carries a permanence danger note. */
export const DatasetWriteDeleteDataset: Story = datasetWriteStory(
  DELETE_DATASET_TOOL_NAME,
  "dw-delete-dataset",
  { kind: "delete-dataset", datasetName: "support-conversations" }
);

/** delete_dataset_examples awaiting approval — carries a scope danger note. */
export const DatasetWriteDeleteExamples: Story = datasetWriteStory(
  DELETE_DATASET_EXAMPLES_TOOL_NAME,
  "dw-delete-examples",
  {
    kind: "delete-examples",
    datasetName: "support-conversations",
    exampleIds: ["RXhhbXBsZTox", "RXhhbXBsZToy"],
  }
);

/** delete_dataset_splits awaiting approval — instance-wide danger note. */
export const DatasetWriteDeleteSplits: Story = datasetWriteStory(
  DELETE_DATASET_SPLITS_TOOL_NAME,
  "dw-delete-splits",
  { kind: "delete-splits", splitNames: ["hard-cases"] }
);

/** delete_dataset_labels awaiting approval — instance-wide danger note. */
export const DatasetWriteDeleteLabels: Story = datasetWriteStory(
  DELETE_DATASET_LABELS_TOOL_NAME,
  "dw-delete-labels",
  { kind: "delete-labels", labelNames: ["needs-review"] }
);

// ---------------------------------------------------------------------------
// Annotation config write approvals (AnnotationConfigWriteApprovalCard)
// ---------------------------------------------------------------------------

/** create_annotation_config awaiting approval. */
export const AnnotationConfigCreate: Story = {
  args: {
    part: makePart({
      toolName: CREATE_ANNOTATION_CONFIG_TOOL_NAME,
      toolCallId: "ac-create",
      state: "input-available",
      input: {},
    }),
  },
  decorators: [
    withAgentStoreSetup((store) => {
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
    }),
  ],
};

/** update_annotation_config awaiting approval — carries a full-replace danger note. */
export const AnnotationConfigUpdate: Story = {
  args: {
    part: makePart({
      toolName: UPDATE_ANNOTATION_CONFIG_TOOL_NAME,
      toolCallId: "ac-update",
      state: "input-available",
      input: {},
    }),
  },
  decorators: [
    withAgentStoreSetup((store) => {
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
    }),
  ],
};

// ---------------------------------------------------------------------------
// patch_experiment approval (PatchExperimentToolDetails)
// ---------------------------------------------------------------------------

/** patch_experiment awaiting approval — renders a per-field before/after diff. */
export const PatchExperimentAwaitingApproval: Story = {
  args: {
    part: makePart({
      toolName: PATCH_EXPERIMENT_TOOL_NAME,
      toolCallId: "px-patch",
      state: "input-available",
      input: {},
    }),
  },
  decorators: [
    withAgentStoreSetup((store) => {
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
          { field: "name", previous: "router-v3", next: "router-v3-tuned" },
          {
            field: "description",
            previous: null,
            next: "Tuned routing thresholds after error analysis.",
          },
        ],
        accept: async () => undefined,
        reject: async () => undefined,
      } satisfies PendingPatchExperiment);
    }),
  ],
};

// ---------------------------------------------------------------------------
// batch_span_annotate approval (BatchSpanAnnotateToolDetails)
// ---------------------------------------------------------------------------

/** batch_span_annotate awaiting approval — renders the proposed annotations. */
export const BatchSpanAnnotateAwaitingApproval: Story = {
  args: {
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
  },
  decorators: [
    withAgentStoreSetup((store) => {
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
    }),
  ],
};
