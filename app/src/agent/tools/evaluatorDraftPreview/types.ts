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

export type EvaluatorPreviewRunnerFactory = (options?: {
  /**
   * Whether the runner should push its result into the form's own preview
   * panel/error state. Defaults to false: batched preview cases don't have a
   * single "current" result to show, so they only surface through the tool's
   * returned JSON. The legacy single-payload path passes `true` so an
   * agent-triggered test call still updates the UI the same way the manual
   * "Run test" button does.
   */
  shouldUpdateUi?: boolean;
}) => EvaluatorPreviewActionResult<EvaluatorPreviewRunner>;

export type EvaluatorPreviewCaseResult =
  | { id: string; result: unknown; latencyMs: number }
  // `result` is included alongside `error` when the evaluator produced
  // partial output (e.g. one output config errored while another
  // succeeded) so successful annotations aren't discarded.
  | { id: string; error: string; latencyMs: number; result?: unknown };

export type EvaluatorPreviewBatchOutput = {
  summary: { total: number; succeeded: number; failed: number };
  cases: EvaluatorPreviewCaseResult[];
};
