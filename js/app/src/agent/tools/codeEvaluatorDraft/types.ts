import type { z } from "zod";

import type {
  ApprovalSource,
  EvaluatorSubmitResult,
  EvaluatorSubmitToolOutput,
} from "@phoenix/agent/tools/approval";
import type {
  ClassificationEvaluatorAnnotationConfig,
  CodeEvaluatorLanguage,
  ContinuousEvaluatorAnnotationConfig,
  EvaluatorInputMapping,
  EvaluatorMappingSource,
  FreeformEvaluatorAnnotationConfig,
} from "@phoenix/types";

export type {
  ApprovalSource,
  EvaluatorSubmitResult,
  EvaluatorSubmitToolOutput,
};

import type { UiOperationResultEmitter } from "@phoenix/agent/uiOperations/types";

import type {
  editCodeEvaluatorDraftInputSchema,
  editCodeEvaluatorDraftOperationSchema,
  readCodeEvaluatorDraftInputSchema,
  testCodeEvaluatorDraftInputSchema,
} from "./schemas";

export type ReadCodeEvaluatorDraftInput = z.output<
  typeof readCodeEvaluatorDraftInputSchema
>;

export type EditCodeEvaluatorDraftOperation = z.output<
  typeof editCodeEvaluatorDraftOperationSchema
>;

export type EditCodeEvaluatorDraftInput = z.output<
  typeof editCodeEvaluatorDraftInputSchema
>;

export type TestCodeEvaluatorDraftInput = z.output<
  typeof testCodeEvaluatorDraftInputSchema
>;

export type CodeEvaluatorFormMode = "create" | "edit";

export type OpenCodeEvaluatorFormInput = Record<string, never>;

export type SubmitCodeEvaluatorDraftInput = Record<string, never>;

export type ClassificationOutputConfigDraft = Omit<
  ClassificationEvaluatorAnnotationConfig,
  "values"
> & {
  kind: "classification";
  values: { label: string; score?: number | null }[];
};

export type ContinuousOutputConfigDraft =
  ContinuousEvaluatorAnnotationConfig & {
    kind: "continuous";
  };

export type FreeformOutputConfigDraft = FreeformEvaluatorAnnotationConfig & {
  kind: "freeform";
};

export type OutputConfigDraft =
  | ClassificationOutputConfigDraft
  | ContinuousOutputConfigDraft
  | FreeformOutputConfigDraft;

export type CodeEvaluatorDraftSnapshot = {
  mode: CodeEvaluatorFormMode;
  evaluatorNodeId: string | null;
  name: string;
  description: string;
  language: CodeEvaluatorLanguage;
  sourceCode: string;
  sandboxConfigId: string | null;
  inputMapping: EvaluatorInputMapping;
  testPayload: EvaluatorMappingSource;
  outputConfigs: OutputConfigDraft[];
};

export type CodeEvaluatorActionResult<TOutput> =
  | { ok: true; output: TOutput }
  | { ok: false; error: string };

export type CodeEvaluatorDraftHost = {
  getSnapshot: () => CodeEvaluatorDraftSnapshot;
  applyOperations: (
    operations: EditCodeEvaluatorDraftOperation[]
  ) => CodeEvaluatorActionResult<CodeEvaluatorDraftSnapshot>;
  previewOperations: (
    snapshot: CodeEvaluatorDraftSnapshot,
    operations: EditCodeEvaluatorDraftOperation[]
  ) => CodeEvaluatorActionResult<CodeEvaluatorDraftSnapshot>;
  submit: (options: {
    approvalSource: ApprovalSource;
  }) => Promise<EvaluatorSubmitResult>;
};

export type PendingCodeEvaluatorEdit = {
  /**
   * Key of this pending entry. Under `execute_ui` this is the inner
   * operation call id (`<toolCallId>:<sequence>`), not an AI SDK toolCallId;
   * the field keeps its historical name to limit churn across consumers.
   */
  toolCallId: string;
  /** Agent session that owns the unresolved evaluators.code.edit call. */
  sessionId: string;
  before: CodeEvaluatorDraftSnapshot;
  after: CodeEvaluatorDraftSnapshot;
  operations: EditCodeEvaluatorDraftOperation[];
  accept?: (options?: { approvalSource?: ApprovalSource }) => Promise<void>;
  reject?: () => Promise<void>;
  cancel?: () => Promise<void>;
};

export type BindPendingCodeEvaluatorEditOptions = {
  pendingEdit: PendingCodeEvaluatorEdit;
  draftHost: CodeEvaluatorDraftHost;
  /** Resolves the awaiting `execute_ui` script call with the user's decision. */
  emitResult: UiOperationResultEmitter;
  setPendingCodeEvaluatorEdit: (
    toolCallId: string,
    edit: PendingCodeEvaluatorEdit | null
  ) => void;
};
