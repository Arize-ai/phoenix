import type { z } from "zod";

import type { ApprovalSource } from "@phoenix/agent/tools/approval";
import type { ChatMessage, PlaygroundStore } from "@phoenix/store/playground";

import type {
  clonePromptInstanceInputSchema,
  editPromptActionContextSchema,
  editPromptInputSchema,
  editPromptOperationSchema,
  PromptEditToolOutputSender,
  readPromptInputSchema,
} from "./schemas";

export type { PromptEditToolOutputSender } from "./schemas";
export type PromptMessageRole = ChatMessage["role"];
export type PromptToolCalls = NonNullable<ChatMessage["toolCalls"]>;

export type ReadPromptInput = z.output<typeof readPromptInputSchema>;

export type ClonePromptInstanceInput = z.output<
  typeof clonePromptInstanceInputSchema
>;

export type PromptMessageSnapshot = {
  id: number;
  role: PromptMessageRole;
  content?: string;
  toolCallId?: string;
  toolCalls?: PromptToolCalls;
};

export type PromptSnapshot = {
  instanceId: number;
  index: number;
  label: string;
  revision: string;
  dirty: boolean;
  prompt: {
    id?: string;
    version?: string;
    tag?: string | null;
  } | null;
  messages: PromptMessageSnapshot[];
};

export type EditPromptOperation = z.output<typeof editPromptOperationSchema>;

export type UpdatePromptMessageOperation = Extract<
  EditPromptOperation,
  { type: "update_message" }
>;

export type InsertPromptMessageOperation = Extract<
  EditPromptOperation,
  { type: "insert_message" }
>;

export type DeletePromptMessageOperation = Extract<
  EditPromptOperation,
  { type: "delete_message" }
>;

export type ReorderPromptMessagesOperation = Extract<
  EditPromptOperation,
  { type: "reorder_messages" }
>;

export type EditPromptInput = z.output<typeof editPromptInputSchema>;

type MaterializedInsertPromptMessageOperation = InsertPromptMessageOperation & {
  messageId: number;
};

export type MaterializedEditPromptOperation =
  | UpdatePromptMessageOperation
  | MaterializedInsertPromptMessageOperation
  | DeletePromptMessageOperation
  | ReorderPromptMessagesOperation;

/**
 * GitHub-style summary of an applied prompt edit, persisted onto the tool
 * output so the accepted result can be rendered after the live before/after
 * snapshots have been cleared from the store.
 */
export type PromptEditSummary = {
  /** Zero-based instance position used to render the A/B/C… badge. */
  instanceIndex: number;
  /** Human-readable instance label (e.g. the prompt name). */
  instanceLabel: string;
  /** Count of added lines in the diff. */
  additions: number;
  /** Count of removed lines in the diff. */
  deletions: number;
};

export type PendingPromptEdit = {
  toolCallId: string;
  /** Agent session that owns the unresolved edit_prompt_instance tool call. */
  sessionId: string;
  instanceId: number;
  expectedRevision: string;
  before: PromptSnapshot;
  after: PromptSnapshot;
  operations: MaterializedEditPromptOperation[];
  accept?: (options?: { approvalSource?: ApprovalSource }) => Promise<void>;
  reject?: () => Promise<void>;
  cancel?: () => Promise<void>;
};

export type EditPromptActionContext = z.output<
  typeof editPromptActionContextSchema
>;

export type BindPendingPromptEditOptions = {
  /** Serializable pending edit proposal, possibly restored from Zustand. */
  pendingEdit: PendingPromptEdit;
  /** Live playground store used to re-check revisions and apply accepted edits. */
  playgroundStore: PlaygroundStore;
  /** Live AI SDK tool-output sender for the original tool call. */
  addToolOutput: PromptEditToolOutputSender;
  setPendingPromptEdit: (
    toolCallId: string,
    edit: PendingPromptEdit | null
  ) => void;
};

export type PromptActionResult<TOutput> =
  | { ok: true; output: TOutput }
  | { ok: false; error: string };
