import type { z } from "zod";

import type {
  ApprovalSource,
  EvaluatorSubmitResult,
} from "@phoenix/agent/tools/approval";
import type { OutputConfigDraft } from "@phoenix/agent/tools/codeEvaluatorDraft";
import type { TemplateFormat } from "@phoenix/components/templateEditor/types";
import type {
  EvaluatorInputMapping,
  EvaluatorMappingSource,
} from "@phoenix/types";

export type { ApprovalSource, EvaluatorSubmitResult };

import type {
  editLlmEvaluatorDraftActionContextSchema,
  editLlmEvaluatorDraftInputSchema,
  editLlmEvaluatorDraftOperationSchema,
  LlmEvaluatorEditToolOutputSender,
  readLlmEvaluatorDraftInputSchema,
  testLlmEvaluatorDraftInputSchema,
} from "./schemas";

export type { LlmEvaluatorEditToolOutputSender } from "./schemas";

export type ReadLlmEvaluatorDraftInput = z.output<
  typeof readLlmEvaluatorDraftInputSchema
>;

export type TestLlmEvaluatorDraftInput = z.output<
  typeof testLlmEvaluatorDraftInputSchema
>;

export type EditLlmEvaluatorDraftOperation = z.output<
  typeof editLlmEvaluatorDraftOperationSchema
>;

export type EditLlmEvaluatorDraftInput = z.output<
  typeof editLlmEvaluatorDraftInputSchema
>;

export type EditLlmEvaluatorDraftActionContext = z.output<
  typeof editLlmEvaluatorDraftActionContextSchema
>;

export type LlmEvaluatorFormMode = "create" | "edit";

export type OpenLlmEvaluatorFormInput = Record<string, never>;

export type LlmEvaluatorJudgeDraft = {
  model: string;
  provider: string;
  templateFormat: TemplateFormat;
  messages: readonly unknown[];
  invocationParameters: unknown;
  tools: unknown;
  toolChoice: unknown;
};

export type LLMEvaluatorDraftSnapshot = {
  mode: LlmEvaluatorFormMode;
  evaluatorNodeId: string | null;
  name: string;
  description: string;
  inputMapping: EvaluatorInputMapping;
  testPayload: EvaluatorMappingSource;
  includeExplanation: boolean;
  outputConfigs: OutputConfigDraft[];
  judge: LlmEvaluatorJudgeDraft;
};

export type LlmEvaluatorActionResult<TOutput> =
  | { ok: true; output: TOutput }
  | { ok: false; error: string };

export type LlmEvaluatorDraftHost = {
  getSnapshot: () => LLMEvaluatorDraftSnapshot;
  applyOperations: (
    operations: EditLlmEvaluatorDraftOperation[]
  ) => LlmEvaluatorActionResult<LLMEvaluatorDraftSnapshot>;
  previewOperations: (
    snapshot: LLMEvaluatorDraftSnapshot,
    operations: EditLlmEvaluatorDraftOperation[]
  ) => LlmEvaluatorActionResult<LLMEvaluatorDraftSnapshot>;
  // Drives the dialog's validated create/patch mutation — the same path the
  // manual Create/Update button runs. Only the terminal save tool calls this;
  // draft edits never persist.
  submit: (options: {
    approvalSource: ApprovalSource;
  }) => Promise<EvaluatorSubmitResult>;
};

export type PendingLlmEvaluatorEdit = {
  toolCallId: string;
  sessionId: string;
  before: LLMEvaluatorDraftSnapshot;
  after: LLMEvaluatorDraftSnapshot;
  operations: EditLlmEvaluatorDraftOperation[];
  accept?: (options?: { approvalSource?: ApprovalSource }) => Promise<void>;
  reject?: () => Promise<void>;
  cancel?: () => Promise<void>;
};

export type BindPendingLlmEvaluatorEditOptions = {
  pendingEdit: PendingLlmEvaluatorEdit;
  draftHost: LlmEvaluatorDraftHost;
  addToolOutput: LlmEvaluatorEditToolOutputSender;
  setPendingLlmEvaluatorEdit: (
    toolCallId: string,
    edit: PendingLlmEvaluatorEdit | null
  ) => void;
};
