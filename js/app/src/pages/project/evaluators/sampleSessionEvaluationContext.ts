import { getEvaluatorBoundVariableNames } from "@phoenix/pages/project/evaluators/evaluatorBoundVariables";
import type { EvaluatorMappingSource } from "@phoenix/types";

/**
 * The session's standard fields with no values, for a project whose scope
 * matches no sessions yet. Authoring needs the record's shape — which paths
 * exist, which names bind — and inventing values would only dress the shape up
 * as data, so every field is null until a real session supplies the values.
 * One empty turn keeps the turn shape drillable.
 *
 * Mirrors the entity `session_eval_context()` builds: `input` and `session`
 * hold the same document, `output` is the newest turn's output.
 */
export type SampleSessionEvaluationContext = {
  context: EvaluatorMappingSource<"session">;
  /** The names a session supplies, matching `sessionEvaluationBoundVariables`. */
  boundVariables: Record<string, unknown>;
};

const SESSION_DOCUMENT: Record<string, unknown> = {
  session_id: null,
  start_time: null,
  end_time: null,
  duration_ms: null,
  turns: [
    {
      input: null,
      output: null,
      event_time: null,
    },
  ],
};

const SESSION_SAMPLE: SampleSessionEvaluationContext = {
  context: {
    // `input` and `session` hold the same document, exactly as the server
    // builds the context.
    input: SESSION_DOCUMENT,
    output: null,
    session: SESSION_DOCUMENT,
  },
  boundVariables: Object.fromEntries(
    [...getEvaluatorBoundVariableNames("session")].map((name) => [name, null])
  ),
};

export function getSampleSessionEvaluationContext(): SampleSessionEvaluationContext {
  return SESSION_SAMPLE;
}
