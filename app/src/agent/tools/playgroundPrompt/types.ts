import type { z } from "zod";

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

export type PendingPromptEdit = {
  toolCallId: string;
  /** Agent session that owns the unresolved edit_prompt tool call. */
  sessionId: string;
  instanceId: number;
  expectedRevision: string;
  before: PromptSnapshot;
  after: PromptSnapshot;
  operations: MaterializedEditPromptOperation[];
  accept?: () => Promise<void>;
  reject?: () => Promise<void>;
};

export type EditPromptActionContext = z.output<
  typeof editPromptActionContextSchema
>;

export type BindPendingPromptEditOptions = {
  /** Serializable pending edit proposal, possibly restored from Zustand. */
  pendingEdit: PendingPromptEdit;
  /** Live playground store used to re-check revisions and apply accepted edits. */
  playgroundStore: PlaygroundStore;
  /** Returns the live AI SDK tool-output sender for the pending edit's session. */
  getAddToolOutput: (
    sessionId: string
  ) => PromptEditToolOutputSender | undefined;
  setPendingPromptEdit: (
    toolCallId: string,
    edit: PendingPromptEdit | null
  ) => void;
};

export type PromptActionResult<TOutput> =
  | { ok: true; output: TOutput }
  | { ok: false; error: string };
