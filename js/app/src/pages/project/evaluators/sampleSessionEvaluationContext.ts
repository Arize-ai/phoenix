import { SESSION_TURN_FIELDS } from "@phoenix/pages/project/evaluators/evaluatorBoundVariables";
import type { GenericEvaluationContext } from "@phoenix/pages/project/evaluators/sampleSpanEvaluationContext";
import { genericMetadata } from "@phoenix/pages/project/evaluators/sampleSpanEvaluationContext";
import type { EvaluatorMappingSource } from "@phoenix/types";

/**
 * Mirrors the server's `session_eval_context()`. A project with no recorded
 * sessions yet still needs something to author a mapping against, the same way
 * the span grain has a sample span.
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
    metadata: {},
    event_time: "2026-01-14T18:20:11.402000+00:00",
    span_id: "f9c1b27fca361f90",
  },
  {
    input: "I ran the lock query and there's a long-running SELECT.",
    output:
      "Cancel that SELECT and the migration will proceed. Rerun the deploy " +
      "once it clears.",
    metadata: {},
    event_time: "2026-01-14T18:24:47.911000+00:00",
    span_id: "a361f90f84cb27fc",
  },
];

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
    metadata: {
      ...SESSION_VOCABULARY,
      start_time: "2026-01-14T18:20:11.402000+00:00",
      end_time: "2026-01-14T18:24:49.183000+00:00",
      turns: TURNS,
    },
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
const GENERIC_SESSION_CONTEXT: GenericEvaluationContext<"session"> = {
  context: {
    input: null,
    output: null,
    metadata: {
      ...genericMetadata("session"),
      turns: [
        Object.fromEntries(SESSION_TURN_FIELDS.map((field) => [field, null])),
      ],
    },
  },
};

export function getGenericSessionEvaluationContext(): GenericEvaluationContext<"session"> {
  return GENERIC_SESSION_CONTEXT;
}
