import type { z } from "zod";

import type { PendingApprovalActions } from "@phoenix/agent/shared/pendingApproval";
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

import { EDIT_LLM_EVALUATOR_DRAFT_TOOL_NAME } from "./constants";
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
  toolCallId: string;
  toolName: typeof EDIT_LLM_EVALUATOR_DRAFT_TOOL_NAME;
  sessionId: string;
  before: LLMEvaluatorDraftSnapshot;
  after: LLMEvaluatorDraftSnapshot;
  operations: EditLlmEvaluatorDraftOperation[];
} & PendingApprovalActions;

export type BindPendingLlmEvaluatorEditOptions = {
  pendingEdit: Omit<PendingLlmEvaluatorEdit, keyof PendingApprovalActions>;
  draftHost: LlmEvaluatorDraftHost;
  addToolOutput: LlmEvaluatorEditToolOutputSender;
  /** Clears this proposal from the unified pending-approval store slice. */
  clearPending: (toolCallId: string) => void;
};
