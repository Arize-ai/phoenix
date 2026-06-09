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
  // Drives the dialog's validated create/patch mutation — the same path the
  // manual Create/Update button runs. Only the terminal save tool calls this;
  // draft edits never persist.
  submit: (options: {
    approvalSource: ApprovalSource;
  }) => Promise<EvaluatorSubmitResult>;
};

export type PendingCodeEvaluatorEdit = {
  toolCallId: string;
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
  addToolOutput: CodeEvaluatorEditToolOutputSender;
  setPendingCodeEvaluatorEdit: (
    toolCallId: string,
    edit: PendingCodeEvaluatorEdit | null
  ) => void;
};
