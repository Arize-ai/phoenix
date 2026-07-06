import type { z } from "zod";

import type { PendingApprovalActions } from "@phoenix/agent/shared/pendingApproval";
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

import { EDIT_CODE_EVALUATOR_DRAFT_TOOL_NAME } from "./constants";
import type {
  CodeEvaluatorEditToolOutputSender,
  editCodeEvaluatorDraftActionContextSchema,
  editCodeEvaluatorDraftInputSchema,
  editCodeEvaluatorDraftOperationSchema,
  readCodeEvaluatorDraftInputSchema,
  testCodeEvaluatorDraftInputSchema,
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

export type TestCodeEvaluatorDraftInput = z.output<
  typeof testCodeEvaluatorDraftInputSchema
>;

export type EditCodeEvaluatorDraftActionContext = z.output<
  typeof editCodeEvaluatorDraftActionContextSchema
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
  toolCallId: string;
  toolName: typeof EDIT_CODE_EVALUATOR_DRAFT_TOOL_NAME;
  sessionId: string;
  before: CodeEvaluatorDraftSnapshot;
  after: CodeEvaluatorDraftSnapshot;
  operations: EditCodeEvaluatorDraftOperation[];
} & PendingApprovalActions;

export type BindPendingCodeEvaluatorEditOptions = {
  pendingEdit: Omit<PendingCodeEvaluatorEdit, keyof PendingApprovalActions>;
  draftHost: CodeEvaluatorDraftHost;
  addToolOutput: CodeEvaluatorEditToolOutputSender;
  /** Clears this proposal from the unified pending-approval store slice. */
  clearPending: (toolCallId: string) => void;
};
