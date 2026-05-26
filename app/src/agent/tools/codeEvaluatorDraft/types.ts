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
 * Dataset surface state captured at create-proposal-propose time. The commit
 * handler uses this snapshot both to pick the standalone vs chained mutation
 * path AND to detect stale dataset context at accept time.
 */
export type PendingCodeEvaluatorCreateDatasetSnapshot = {
  datasetNodeId: string;
  datasetVersionNodeId: string | null;
};

export type PendingCodeEvaluatorCreate = {
  toolCallId: string;
  sessionId: string;
  /** Empty-shaped baseline snapshot driving the create-mode diff render. */
  before: CodeEvaluatorDraftSnapshot;
  /** Proposed snapshot (always `mode: "create"`). */
  after: CodeEvaluatorDraftSnapshot;
  /** Active dataset surface at propose time, `null` => standalone create. */
  datasetContext: PendingCodeEvaluatorCreateDatasetSnapshot | null;
  /** Relay connection IDs to `@appendNode` on dataset-evaluator binds. */
  connectionIds: string[];
  accept?: () => Promise<void>;
  reject?: () => Promise<void>;
  cancel?: () => Promise<void>;
};

export type BindPendingCodeEvaluatorCreateOptions = {
  pendingCreate: PendingCodeEvaluatorCreate;
  addToolOutput: CodeEvaluatorEditToolOutputSender;
  setPendingCodeEvaluatorCreate: (
    toolCallId: string,
    pending: PendingCodeEvaluatorCreate | null
  ) => void;
  /**
   * Live read of the agent store's active dataset context. The commit
   * handler invokes this at accept time for the stale-recheck.
   */
  getActiveDatasetContext: () =>
    | PendingCodeEvaluatorCreateDatasetSnapshot
    | null;
};
