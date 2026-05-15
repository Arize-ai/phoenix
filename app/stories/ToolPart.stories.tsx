import { css } from "@emotion/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useEffect, useRef } from "react";

import {
  ElicitationDraftProvider,
  type PendingElicitationDraft,
} from "@phoenix/components/agent/ElicitationDraftContext";
import {
  ToolPart,
  type ToolPartType,
} from "@phoenix/components/agent/ToolPart";

const containerCSS = css`
  max-width: 780px;
  width: 100%;
`;

const storyNoteCSS = css`
  margin-bottom: var(--ac-global-dimension-size-200);
  padding: var(--ac-global-dimension-size-150);
  border: 1px solid var(--ac-global-color-grey-300);
  border-radius: var(--ac-global-rounding-small);
  background: var(--ac-global-color-grey-100);
  color: var(--ac-global-text-color-900);
  font-size: 12px;
  line-height: 1.5;

  strong {
    display: block;
    margin-bottom: var(--ac-global-dimension-size-50);
    font-weight: 600;
  }
`;

function OpenByDefault({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector("details")?.setAttribute("open", "");
  }, []);
  return <div ref={ref}>{children}</div>;
}

function withElicitationDraft(draft: PendingElicitationDraft) {
  return (Story: () => React.ReactNode) => (
    <ElicitationDraftProvider draft={draft}>
      <Story />
    </ElicitationDraftProvider>
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
  toolName: "search_phoenix",
  state: "output-available",
  input: { query: "how to configure tracing" },
  output:
    "Found 3 results:\n\n1. Getting Started with Tracing\n   /docs/tracing/quickstart\n\n2. Tracing Configuration Options\n   /docs/tracing/configuration\n\n3. Advanced Tracing Patterns\n   /docs/tracing/advanced",
});

const docsSearchRunningPart = makePart({
  toolName: "search_phoenix",
  state: "input-available",
  input: { query: "embeddings visualization" },
});

const docsFilesystemQueryPart = makePart({
  toolName: "query_docs_filesystem_phoenix",
  state: "output-available",
  input: { command: "head -80 /docs/tracing/quickstart.mdx" },
  output:
    "# Getting Started with Tracing\n\nPhoenix tracing helps you understand your LLM application's behavior...\n\n## Installation\n\n```bash\npip install arize-phoenix\n```\n\n## Quick Start\n\nImport and initialize the tracer:\n\n```python\nimport phoenix as px\npx.launch_app()\n```",
});

const docsFilesystemQueryRunningPart = makePart({
  toolName: "query_docs_filesystem_phoenix",
  state: "input-available",
  input: { command: "head -80 /docs/evaluation/overview.mdx" },
});

// ---------------------------------------------------------------------------
// ToolPart stories
// ---------------------------------------------------------------------------

const toolPartMeta = {
  title: "Agent/ToolPart",
  component: ToolPart,
  decorators: [
    (Story) => (
      <OpenByDefault>
        <div css={containerCSS}>
          <Story />
        </div>
      </OpenByDefault>
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
export const DocsFilesystemQuery: Story = {
  args: { part: docsFilesystemQueryPart },
};

/** A docs filesystem query tool currently running. */
export const DocsFilesystemQueryRunning: Story = {
  args: { part: docsFilesystemQueryRunningPart },
};
