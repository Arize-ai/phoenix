import type { z } from "zod";

import type {
  ApprovalSource,
  EvaluatorSubmitResult,
  EvaluatorSubmitToolOutput,
} from "@phoenix/agent/tools/approval";
import type { OutputConfigDraft } from "@phoenix/agent/tools/codeEvaluatorDraft";
import type { TemplateFormat } from "@phoenix/components/templateEditor/types";
import type {
  EvaluatorInputMapping,
  EvaluatorMappingSource,
} from "@phoenix/types";

export type {
  ApprovalSource,
  EvaluatorSubmitResult,
  EvaluatorSubmitToolOutput,
};

import type { UiOperationResultEmitter } from "@phoenix/agent/uiOperations/types";

import type {
  editLlmEvaluatorDraftInputSchema,
  editLlmEvaluatorDraftOperationSchema,
  readLlmEvaluatorDraftInputSchema,
  testLlmEvaluatorDraftInputSchema,
} from "./schemas";

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

export type LlmEvaluatorFormMode = "create" | "edit";

export type OpenLlmEvaluatorFormInput = Record<string, never>;

export type SubmitLlmEvaluatorDraftInput = Record<string, never>;

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
  submit: (options: {
    approvalSource: ApprovalSource;
  }) => Promise<EvaluatorSubmitResult>;
};

export type PendingLlmEvaluatorEdit = {
  /**
   * Key of this pending entry. Under `execute_ui` this is the inner
   * operation call id (`<toolCallId>:<sequence>`), not an AI SDK toolCallId;
   * the field keeps its historical name to limit churn across consumers.
   */
  toolCallId: string;
  /** Agent session that owns the unresolved evaluators.llm.edit call. */
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
  /** Resolves the awaiting `execute_ui` script call with the user's decision. */
  emitResult: UiOperationResultEmitter;
  setPendingLlmEvaluatorEdit: (
    toolCallId: string,
    edit: PendingLlmEvaluatorEdit | null
  ) => void;
};
