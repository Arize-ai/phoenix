import type { AgentClientActionResult } from "@phoenix/store/agentStore";

import { runEvaluatorPreviewCases } from "./runPreviewCases";
import type {
  EvaluatorDraftPreviewInput,
  EvaluatorPreviewRunnerFactory,
} from "./types";

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
