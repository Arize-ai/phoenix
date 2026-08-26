import { getEvaluatorBoundVariableNames } from "@phoenix/pages/project/evaluators/evaluatorBoundVariables";
import type { GenericEvaluationContext } from "@phoenix/pages/project/evaluators/sampleSpanEvaluationContext";
import type { EvaluatorMappingSource } from "@phoenix/types";

/**
 * Mirrors the server's `session_eval_context()`: `input` and `output` are the
 * values the session filter language spells `first_input` and `last_output`,
 * and `metadata` carries those names flat beside the whole session record
 * under `metadata.session`.
 *
 * A project with no recorded sessions yet still needs something to author a
 * mapping against, the same way the span grain has a sample span.
 */
export type SampleSessionEvaluationContext = {
  context: EvaluatorMappingSource<"session">;
};

const TURNS = [
  {
    input: "My deploy is stuck on the migration step. Can you help?",
    output:
      "It looks like the migration is waiting on a lock. Let's check which " +
      "query is holding it.",
    event_time: "2026-01-14T18:20:11.402000+00:00",
  },
  {
    input: "I ran the lock query and there's a long-running SELECT.",
    output:
      "Cancel that SELECT and the migration will proceed. Rerun the deploy " +
      "once it clears.",
    event_time: "2026-01-14T18:24:47.911000+00:00",
  },
];

const SESSION_DOCUMENT: Record<string, unknown> = {
  session_id: "support-2026-01-14-8842",
  start_time: "2026-01-14T18:20:11.402000+00:00",
  end_time: "2026-01-14T18:24:49.183000+00:00",
  duration_ms: 277781.0,
  turns: TURNS,
};

/** The session's own names, exactly as the session filter language spells them. */
const SESSION_VOCABULARY: Record<string, unknown> = {
  session_id: "support-2026-01-14-8842",
  user_id: "user_2f9c",
  first_input: TURNS[0].input,
  last_output: TURNS[TURNS.length - 1].output,
  duration_ms: 277781.0,
  num_traces: 2,
  num_traces_with_error: 0,
  llm_span_count: 4,
  tool_span_count: 1,
  token_count_prompt: 1840,
  token_count_completion: 296,
  token_count_total: 2136,
  prompt_cost: 0.0046,
  completion_cost: 0.0018,
  total_cost: 0.0064,
};

const SESSION_SAMPLE: SampleSessionEvaluationContext = {
  context: {
    input: SESSION_VOCABULARY.first_input,
    output: SESSION_VOCABULARY.last_output,
    metadata: { ...SESSION_VOCABULARY, session: SESSION_DOCUMENT },
  },
};

export function getSampleSessionEvaluationContext(): SampleSessionEvaluationContext {
  return SESSION_SAMPLE;
}

/**
 * The session's standard fields with no values, mirroring the span grain's
 * generic context: the completion popup and bindings list build from this
 * skeleton, and one empty turn keeps the turn shape drillable. The sample
 * above exists only as a runnable demo record.
 */
const GENERIC_SESSION_DOCUMENT: Record<string, unknown> = {
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

const GENERIC_SESSION_CONTEXT: GenericEvaluationContext<"session"> = {
  context: {
    input: null,
    output: null,
    metadata: {
      ...Object.fromEntries(
        [...getEvaluatorBoundVariableNames("session")].map((name) => [
          name,
          null,
        ])
      ),
      session: GENERIC_SESSION_DOCUMENT,
    },
  },
};

export function getGenericSessionEvaluationContext(): GenericEvaluationContext<"session"> {
  return GENERIC_SESSION_CONTEXT;
}
