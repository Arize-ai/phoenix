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
  const runner = createPreviewRunner();
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
  return { ok: true, output: JSON.stringify(batch) };
}
