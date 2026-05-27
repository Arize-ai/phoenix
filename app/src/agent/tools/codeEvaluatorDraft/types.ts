import type { z } from "zod";

import type {
  CodeEvaluatorLanguage,
  EvaluatorInputMapping,
  EvaluatorOptimizationDirection,
} from "@phoenix/types";

import type {
  CodeEvaluatorEditToolOutputSender,
  editCodeEvaluatorDraftActionContextSchema,
  editCodeEvaluatorDraftInputSchema,
  editCodeEvaluatorDraftOperationSchema,
  readCodeEvaluatorDraftInputSchema,
} from "./schemas";

export type { CodeEvaluatorEditToolOutputSender } from "./schemas";

export type ReadCodeEvaluatorDraftInput = z.output<
  typeof readCodeEvaluatorDraftInputSchema
>;

export type EditCodeEvaluatorDraftOperation = z.output<
  typeof editCodeEvaluatorDraftOperationSchema
>;

export type EditCodeEvaluatorDraftInput = z.output<
  typeof editCodeEvaluatorDraftInputSchema
>;

export type EditCodeEvaluatorDraftActionContext = z.output<
  typeof editCodeEvaluatorDraftActionContextSchema
>;

export type CodeEvaluatorFormMode = "create" | "edit";

/**
 * JSON-safe wire shape for one code-evaluator output config.
 *
 * The form's `AnnotationConfig` union ships UI/Relay-adjacent state; this
 * draft shape strips that and discriminates explicitly on `kind` so the
 * agent's tool JSON schemas, the revision hash, and the diff serializer
 * can all consume one stable shape.
 */
export type ClassificationOutputConfigDraft = {
  kind: "classification";
  name: string;
  optimizationDirection: EvaluatorOptimizationDirection;
  values: { label: string; score?: number | null }[];
};

export type ContinuousOutputConfigDraft = {
  kind: "continuous";
  name: string;
  optimizationDirection: EvaluatorOptimizationDirection;
  lowerBound?: number | null;
  upperBound?: number | null;
};

export type FreeformOutputConfigDraft = {
  kind: "freeform";
  name: string;
  optimizationDirection: EvaluatorOptimizationDirection;
  threshold?: number | null;
  lowerBound?: number | null;
  upperBound?: number | null;
};

export type OutputConfigDraft =
  | ClassificationOutputConfigDraft
  | ContinuousOutputConfigDraft
  | FreeformOutputConfigDraft;

/** Snapshot of the open code-evaluator form; `revision` is a content hash over the rest. */
export type CodeEvaluatorDraftSnapshot = {
  mode: CodeEvaluatorFormMode;
  evaluatorNodeId: string | null;
  name: string;
  description: string;
  language: CodeEvaluatorLanguage;
  sourceCode: string;
  sandboxConfigId: string | null;
  inputMapping: EvaluatorInputMapping;
  outputConfigs: OutputConfigDraft[];
  revision: string;
};

export type CodeEvaluatorActionResult<TOutput> =
  | { ok: true; output: TOutput }
  | { ok: false; error: string };

/** Bridge from the open code-evaluator form to the agent. */
export type CodeEvaluatorDraftHost = {
  getSnapshot: () => CodeEvaluatorDraftSnapshot;
  applyOperations: (
    operations: EditCodeEvaluatorDraftOperation[]
  ) => CodeEvaluatorActionResult<CodeEvaluatorDraftSnapshot>;
  /** Pure preview — does not mutate the form. */
  previewOperations: (
    snapshot: CodeEvaluatorDraftSnapshot,
    operations: EditCodeEvaluatorDraftOperation[]
  ) => CodeEvaluatorActionResult<CodeEvaluatorDraftSnapshot>;
};

export type PendingCodeEvaluatorEdit = {
  toolCallId: string;
  sessionId: string;
  expectedRevision: string;
  before: CodeEvaluatorDraftSnapshot;
  after: CodeEvaluatorDraftSnapshot;
  operations: EditCodeEvaluatorDraftOperation[];
  accept?: () => Promise<void>;
  reject?: () => Promise<void>;
  cancel?: () => Promise<void>;
};

export type BindPendingCodeEvaluatorEditOptions = {
  pendingEdit: PendingCodeEvaluatorEdit;
  draftHost: CodeEvaluatorDraftHost;
  addToolOutput: CodeEvaluatorEditToolOutputSender;
  setPendingCodeEvaluatorEdit: (
    toolCallId: string,
    edit: PendingCodeEvaluatorEdit | null
  ) => void;
};

/**
 * Dataset surface state captured at create-proposal-propose time. Snapshotted
 * onto the pending entry so the page-mounted slideover knows which dataset
 * the proposal targeted, even if the user navigates before clicking Confirm.
 */
export type PendingCodeEvaluatorCreateDatasetSnapshot = {
  datasetNodeId: string;
  datasetVersionNodeId: string | null;
};

/**
 * Two-phase chassis state for the create flow.
 *
 * - `"preview"` — the chat preview card is mounted with Confirm/Reject. Confirm
 *   flips to `"awaiting-slideover"` without resolving the tool call.
 * - `"awaiting-slideover"` — the dataset evaluators page is responsible for
 *   mounting a slideover prefilled from `after`; the slideover's Save / Cancel
 *   resolves the tool call via the terminal resolvers.
 */
export type PendingCodeEvaluatorCreatePhase = "preview" | "awaiting-slideover";

/**
 * Pending `create_code_evaluator` proposal — the chat-side preview card flips
 * the phase to "awaiting-slideover" on Confirm without committing; the page-
 * mounted slideover is the only commit site. The three terminal resolvers
 * (`resolveAsAccepted` / `resolveAsRejected` / `resolveAsFailed`) are
 * idempotent and gated by the `resolved` latch so the dialog's close handler
 * cannot race a successful Save's terminal as a second rejection.
 */
export type PendingCodeEvaluatorCreate = {
  toolCallId: string;
  sessionId: string;
  /** Empty-shaped baseline snapshot driving the create-mode diff render. */
  before: CodeEvaluatorDraftSnapshot;
  /** Proposed snapshot (always `mode: "create"`). */
  after: CodeEvaluatorDraftSnapshot;
  /** Dataset surface active when the proposal was made. Required for create. */
  datasetContext: PendingCodeEvaluatorCreateDatasetSnapshot;
  /** Two-phase chassis state — flipped from "preview" by `accept`. */
  phase: PendingCodeEvaluatorCreatePhase;
  /** Idempotency latch — set true by the first terminal resolver to fire. */
  resolved: boolean;
  /** Chat preview Confirm — flips `phase` to `"awaiting-slideover"`. Does NOT resolve the tool call. */
  accept?: () => Promise<void>;
  /** Chat preview Reject — terminal `rejected`. */
  reject?: () => Promise<void>;
  /** Slideover Save success — terminal `accepted` with the new evaluator binding. */
  resolveAsAccepted?: (result: {
    datasetEvaluatorId: string;
    createdEvaluator: { id: string; name: string };
  }) => Promise<void>;
  /** Slideover Cancel — terminal `rejected`. */
  resolveAsRejected?: () => Promise<void>;
  /** Slideover Save error — terminal `output-error`. */
  resolveAsFailed?: (errorText: string) => Promise<void>;
  /** Interrupt-cleanup terminal — used by useAgentChat when a session is interrupted. */
  cancel?: () => Promise<void>;
};

export type BindPendingCodeEvaluatorCreateOptions = {
  pendingCreate: Omit<
    PendingCodeEvaluatorCreate,
    | "accept"
    | "reject"
    | "cancel"
    | "resolveAsAccepted"
    | "resolveAsRejected"
    | "resolveAsFailed"
    | "phase"
    | "resolved"
  >;
  addToolOutput: CodeEvaluatorEditToolOutputSender;
  setPendingCodeEvaluatorCreate: (
    toolCallId: string,
    pending: PendingCodeEvaluatorCreate | null
  ) => void;
};
