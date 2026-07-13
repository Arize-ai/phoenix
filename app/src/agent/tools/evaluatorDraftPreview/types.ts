import type { z } from "zod";

import type { EvaluatorMappingSource } from "@phoenix/types";

import type {
  evaluatorDraftPreviewInputSchema,
  evaluatorPreviewCaseSchema,
} from "./schemas";

export type EvaluatorDraftPreviewInput = z.output<
  typeof evaluatorDraftPreviewInputSchema
>;

export type EvaluatorPreviewCase = z.output<typeof evaluatorPreviewCaseSchema>;

export type EvaluatorPreviewActionResult<TOutput> =
  | { ok: true; output: TOutput }
  | { ok: false; error: string };

export type EvaluatorPreviewRunner = (
  testPayload?: EvaluatorMappingSource
) => Promise<EvaluatorPreviewActionResult<unknown>>;

export type EvaluatorPreviewRunnerFactory =
  () => EvaluatorPreviewActionResult<EvaluatorPreviewRunner>;

export type EvaluatorPreviewCaseResult =
  | { id: string; result: unknown; latencyMs: number }
  | { id: string; error: string; latencyMs: number };

export type EvaluatorPreviewBatchOutput = {
  summary: { total: number; succeeded: number; failed: number };
  cases: EvaluatorPreviewCaseResult[];
};
