import type { ProjectEvaluatorMappingSourceGrain } from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";

/**
 * The values a span or session supplies to an evaluator by name alone, with no
 * mapping entry.
 *
 * These are the names a filter condition on the same record already resolves,
 * so a name that selects records can also be read inside the evaluator. The
 * server's list is the one that binds at evaluation time
 * (`phoenix.server.online_eval.bound_variables`); this mirrors it so the
 * authoring surface can name and order them without a round trip.
 */
export type EvaluatorBoundVariable = {
  name: string;
  type: "text" | "number";
  description: string;
};

const SPAN_BOUND_VARIABLES: EvaluatorBoundVariable[] = [
  { name: "span_id", type: "text", description: "The span's identifier." },
  {
    name: "trace_id",
    type: "text",
    description: "The identifier of the trace the span belongs to.",
  },
  {
    name: "parent_id",
    type: "text",
    description: "The identifier of the span's parent, if it has one.",
  },
  { name: "name", type: "text", description: "The span's name." },
  {
    name: "span_kind",
    type: "text",
    description: "The OpenInference kind, such as LLM or TOOL.",
  },
  { name: "status_code", type: "text", description: "OK, ERROR, or UNSET." },
  {
    name: "status_message",
    type: "text",
    description: "The message recorded with the status.",
  },
  {
    name: "latency_ms",
    type: "number",
    description: "How long the span took, in milliseconds.",
  },
  {
    name: "cumulative_llm_token_count_prompt",
    type: "number",
    description: "Prompt tokens for the span and everything beneath it.",
  },
  {
    name: "cumulative_llm_token_count_completion",
    type: "number",
    description: "Completion tokens for the span and everything beneath it.",
  },
  {
    name: "cumulative_llm_token_count_total",
    type: "number",
    description: "Total tokens for the span and everything beneath it.",
  },
];

const SESSION_BOUND_VARIABLES: EvaluatorBoundVariable[] = [
  {
    name: "session_id",
    type: "text",
    description: "The session's identifier.",
  },
  {
    name: "user_id",
    type: "text",
    description: "The user recorded on the session's first trace.",
  },
  {
    name: "first_input",
    type: "text",
    description: "The input of the session's first trace.",
  },
  {
    name: "last_output",
    type: "text",
    description: "The output of the session's last trace.",
  },
  {
    name: "duration_ms",
    type: "number",
    description: "How long the session lasted, in milliseconds.",
  },
  {
    name: "num_traces",
    type: "number",
    description: "How many traces the session contains.",
  },
  {
    name: "num_traces_with_error",
    type: "number",
    description: "How many of those traces ended in an error.",
  },
  {
    name: "llm_span_count",
    type: "number",
    description: "How many LLM spans the session contains.",
  },
  {
    name: "tool_span_count",
    type: "number",
    description: "How many tool spans the session contains.",
  },
  {
    name: "token_count_prompt",
    type: "number",
    description: "Prompt tokens across the session.",
  },
  {
    name: "token_count_completion",
    type: "number",
    description: "Completion tokens across the session.",
  },
  {
    name: "token_count_total",
    type: "number",
    description: "Total tokens across the session.",
  },
  {
    name: "prompt_cost",
    type: "number",
    description: "Cost of the session's prompt tokens.",
  },
  {
    name: "completion_cost",
    type: "number",
    description: "Cost of the session's completion tokens.",
  },
  {
    name: "total_cost",
    type: "number",
    description: "Total cost of the session.",
  },
];

/**
 * Ordered for reading: identity first, then status, then measures. The server
 * returns them unordered, so the order is this list's to decide.
 */
export function getEvaluatorBoundVariables(
  grain: ProjectEvaluatorMappingSourceGrain
): EvaluatorBoundVariable[] {
  return grain === "session" ? SESSION_BOUND_VARIABLES : SPAN_BOUND_VARIABLES;
}

export function getEvaluatorBoundVariableNames(
  grain: ProjectEvaluatorMappingSourceGrain
): Set<string> {
  return new Set(getEvaluatorBoundVariables(grain).map(({ name }) => name));
}
