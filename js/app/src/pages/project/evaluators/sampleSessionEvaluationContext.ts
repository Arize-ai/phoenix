import type { EvaluatorMappingSource } from "@phoenix/types";

/**
 * Mirrors the server's `session_eval_context()`: `input` and `session` hold
 * the same whole-session document, and `output` is the newest turn's output.
 *
 * A project with no recorded sessions yet still needs something to author a
 * mapping against, the same way the span grain has a sample span.
 */
export type SampleSessionEvaluationContext = {
  context: EvaluatorMappingSource<"session">;
  /** What the session would supply by name, matching `sessionEvaluationBoundVariables`. */
  boundVariables: Record<string, unknown>;
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

const SESSION_SAMPLE: SampleSessionEvaluationContext = {
  context: {
    // `input` and `session` hold the same document, exactly as the server
    // builds the context.
    input: SESSION_DOCUMENT,
    output: TURNS[TURNS.length - 1].output,
    session: SESSION_DOCUMENT,
  },
  boundVariables: {
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
  },
};

export function getSampleSessionEvaluationContext(): SampleSessionEvaluationContext {
  return SESSION_SAMPLE;
}
