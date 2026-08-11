import type { z } from "zod";

import type { ApprovalSource } from "@phoenix/agent/tools/approval";
import type { UiOperationResultEmitter } from "@phoenix/agent/uiOperations/types";
import type { ChatMessage, PlaygroundStore } from "@phoenix/store/playground";

import type {
  addPromptInstanceInputSchema,
  clonePromptInstanceInputSchema,
  editPromptInputSchema,
  editPromptOperationSchema,
  readPromptInputSchema,
  removePromptInstanceInputSchema,
  removePromptInstanceOutputSchema,
} from "./schemas";
export type PromptMessageRole = ChatMessage["role"];
export type PromptToolCalls = NonNullable<ChatMessage["toolCalls"]>;

export type ReadPromptInput = z.output<typeof readPromptInputSchema>;

export type ClonePromptInstanceInput = z.output<
  typeof clonePromptInstanceInputSchema
>;

export type AddPromptInstanceInput = z.output<
  typeof addPromptInstanceInputSchema
>;

export type RemovePromptInstanceInput = z.output<
  typeof removePromptInstanceInputSchema
>;

export type RemovePromptInstanceOutput = z.output<
  typeof removePromptInstanceOutputSchema
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
  /**
   * Key of this pending entry. Under `execute_ui` this is the inner
   * operation call id (`<toolCallId>:<sequence>`), not an AI SDK toolCallId;
   * the field keeps its historical name to limit churn across consumers.
   */
  toolCallId: string;
  /** Agent session that owns the unresolved playground.prompt.edit call. */
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

export type PendingPromptInstanceRemoval = {
  /** Inner operation call id under `execute_ui`; see {@link PendingPromptEdit}. */
  toolCallId: string;
  /** Agent session that owns the unresolved playground.instance.remove call. */
  sessionId: string;
  instanceId: number;
  label: string;
  accept?: (options?: { approvalSource?: ApprovalSource }) => Promise<void>;
  reject?: () => Promise<void>;
  cancel?: () => Promise<void>;
};

export type BindPendingPromptEditOptions = {
  /** Serializable pending edit proposal, possibly restored from Zustand. */
  pendingEdit: PendingPromptEdit;
  /** Live playground store used to re-check revisions and apply accepted edits. */
  playgroundStore: PlaygroundStore;
  /** Resolves the awaiting `execute_ui` script call with the user's decision. */
  emitResult: UiOperationResultEmitter;
  setPendingPromptEdit: (
    toolCallId: string,
    edit: PendingPromptEdit | null
  ) => void;
};

export type BindPendingPromptInstanceRemovalOptions = {
  pendingRemoval: PendingPromptInstanceRemoval;
  playgroundStore: PlaygroundStore;
  /** Resolves the awaiting `execute_ui` script call with the user's decision. */
  emitResult: UiOperationResultEmitter;
  setPendingPromptInstanceRemoval: (
    toolCallId: string,
    removal: PendingPromptInstanceRemoval | null
  ) => void;
};

export type PromptActionResult<TOutput> =
  | { ok: true; output: TOutput }
  | { ok: false; error: string };
