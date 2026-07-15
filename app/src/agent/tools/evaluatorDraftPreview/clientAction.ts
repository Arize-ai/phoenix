import type { AgentClientActionResult } from "@phoenix/store/agentStore";

import { runEvaluatorPreviewCases } from "./runPreviewCases";
import {
  evaluatorDraftPreviewInputSchema,
  formatEvaluatorDraftPreviewInputError,
} from "./schemas";
import type {
  EvaluatorDraftPreviewInput,
  EvaluatorPreviewRunnerFactory,
} from "./types";

/**
 * Builds the shared `test_*_evaluator_draft` client action: validate input,
 * check that the draft form is mounted, then run the legacy single preview or
 * the named batch. The code and LLM tools differ only in name, form label,
 * and preview concurrency.
 */
export function createEvaluatorDraftTestClientAction({
  toolName,
  formLabel,
  isDraftMounted,
  createPreviewRunner,
  concurrency,
}: {
  toolName: string;
  formLabel: string;
  isDraftMounted: () => boolean;
  createPreviewRunner: EvaluatorPreviewRunnerFactory;
  concurrency: number;
}) {
  return async (input: unknown): Promise<AgentClientActionResult> => {
    const parsed = evaluatorDraftPreviewInputSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: `Invalid ${toolName} input. ${formatEvaluatorDraftPreviewInputError(parsed.error)}`,
      };
    }
    if (!isDraftMounted()) {
      return {
        ok: false,
        error: `The ${formLabel} is not mounted; cannot test the draft.`,
      };
    }
    return runEvaluatorDraftPreviewClientAction({
      input: parsed.data,
      createPreviewRunner,
      concurrency,
    });
  };
}

/** Executes either the legacy form-payload preview or an ordered named batch. */
export async function runEvaluatorDraftPreviewClientAction({
  input,
  createPreviewRunner,
  concurrency,
}: {
  input: EvaluatorDraftPreviewInput;
  createPreviewRunner: EvaluatorPreviewRunnerFactory;
  concurrency: number;
}): Promise<AgentClientActionResult> {
  // Only the legacy single-payload path pushes results into the form's own
  // preview panel/error state, matching pre-batch behavior. Batched cases
  // don't have one "current" result to show in that panel, so they surface
  // only through the tool's returned JSON.
  const runner = createPreviewRunner({ shouldUpdateUi: !input.cases });
  if (!runner.ok) {
    return runner;
  }
  if (!input.cases) {
    const preview = await runner.output();
    if (!preview.ok) {
      return preview;
    }
    return { ok: true, output: JSON.stringify(preview.output, null, 2) };
  }
  const batch = await runEvaluatorPreviewCases({
    cases: input.cases,
    runPreview: runner.output,
    concurrency,
  });
  // A batch where every case failed (e.g. the sandbox/provider is down)
  // must not be reported as a successful tool call -- only report `ok: true`
  // when at least one case actually produced a result.
  if (batch.summary.total > 0 && batch.summary.failed === batch.summary.total) {
    return {
      ok: false,
      error: `All ${batch.summary.total} preview case(s) failed: ${JSON.stringify(batch)}`,
    };
  }
  return { ok: true, output: JSON.stringify(batch) };
}
