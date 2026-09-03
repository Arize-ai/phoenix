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
 *
 * The two lists are held together by
 * `tests/unit/server/online_eval/test_bound_variables.py`, which fails if
 * either side gains or loses a name. Adding one here without adding it there
 * offers authors a variable no evaluation will bind.
 */
export type EvaluatorBoundVariable = {
  name: string;
  type: "text" | "number" | "object" | "list";
  /** Omitted where the name already says it. */
  description?: string;
};

const SPAN_BOUND_VARIABLES: EvaluatorBoundVariable[] = [
  { name: "span_id", type: "text" },
  { name: "trace_id", type: "text" },
  { name: "parent_id", type: "text" },
  { name: "name", type: "text" },
  { name: "span_kind", type: "text", description: "LLM, TOOL, CHAIN, …" },
  { name: "status_code", type: "text", description: "OK, ERROR, or UNSET." },
  { name: "status_message", type: "text" },
  { name: "latency_ms", type: "number" },
  {
    name: "cumulative_llm_token_count_prompt",
    type: "number",
    description: "Includes descendants.",
  },
  {
    name: "cumulative_llm_token_count_completion",
    type: "number",
    description: "Includes descendants.",
  },
  {
    name: "cumulative_llm_token_count_total",
    type: "number",
    description: "Includes descendants.",
  },
];

const SESSION_BOUND_VARIABLES: EvaluatorBoundVariable[] = [
  { name: "session_id", type: "text" },
  {
    name: "user_id",
    type: "text",
    description: "From the session's first trace.",
  },
  { name: "first_input", type: "text" },
  { name: "last_output", type: "text" },
  { name: "duration_ms", type: "number" },
  { name: "num_traces", type: "number" },
  { name: "num_traces_with_error", type: "number" },
  { name: "llm_span_count", type: "number" },
  { name: "tool_span_count", type: "number" },
  { name: "token_count_prompt", type: "number" },
  { name: "token_count_completion", type: "number" },
  { name: "token_count_total", type: "number" },
  { name: "prompt_cost", type: "number" },
  { name: "completion_cost", type: "number" },
  { name: "total_cost", type: "number" },
];

/** Mirrors the server's SPAN/SESSION_METADATA_FIELD_NAMES via the same test as above. */
const SPAN_METADATA_FIELDS: EvaluatorBoundVariable[] = [
  { name: "start_time", type: "text" },
  { name: "end_time", type: "text" },
  { name: "attributes", type: "object" },
  { name: "events", type: "list" },
  { name: "annotations", type: "object", description: "Grouped by name." },
];

const SESSION_METADATA_FIELDS: EvaluatorBoundVariable[] = [
  { name: "start_time", type: "text" },
  { name: "end_time", type: "text" },
  { name: "turns", type: "list", description: "Oldest first." },
];

/** Every key of a `metadata.turns` entry; mirrors the server via the same test. */
export const SESSION_TURN_FIELDS = [
  "input",
  "output",
  "metadata",
  "event_time",
  "span_id",
] as const;

/** Every key of a `metadata.annotations` entry; mirrors the server via the same test. */
export const SPAN_ANNOTATION_FIELDS = [
  "label",
  "score",
  "explanation",
  "metadata",
  "annotator_kind",
  "user_id",
  "username",
  "email",
] as const;

const BOUND_VARIABLES_BY_GRAIN: Record<
  ProjectEvaluatorMappingSourceGrain,
  EvaluatorBoundVariable[]
> = {
  span: SPAN_BOUND_VARIABLES,
  session: SESSION_BOUND_VARIABLES,
};

const METADATA_FIELDS_BY_GRAIN: Record<
  ProjectEvaluatorMappingSourceGrain,
  EvaluatorBoundVariable[]
> = {
  span: SPAN_METADATA_FIELDS,
  session: SESSION_METADATA_FIELDS,
};

export const EVALUATOR_MAPPING_SOURCE_GRAINS = Object.keys(
  BOUND_VARIABLES_BY_GRAIN
) as ProjectEvaluatorMappingSourceGrain[];

/**
 * Ordered for reading: identity first, then status, then measures. The server
 * returns them unordered, so the order is this list's to decide.
 */
export function getEvaluatorBoundVariables(
  grain: ProjectEvaluatorMappingSourceGrain
): EvaluatorBoundVariable[] {
  return BOUND_VARIABLES_BY_GRAIN[grain];
}

/** The record fields beside the vocabulary, after it in reading order. */
export function getEvaluatorMetadataFields(
  grain: ProjectEvaluatorMappingSourceGrain
): EvaluatorBoundVariable[] {
  return METADATA_FIELDS_BY_GRAIN[grain];
}

export function getEvaluatorMetadataEntries(
  grain: ProjectEvaluatorMappingSourceGrain
): EvaluatorBoundVariable[] {
  const fields = getEvaluatorMetadataFields(grain);
  const isContainer = ({ type }: EvaluatorBoundVariable) =>
    type === "object" || type === "list";
  return [
    ...fields.filter(isContainer),
    ...getEvaluatorBoundVariables(grain),
    ...fields.filter((field) => !isContainer(field)),
  ];
}

export function getEvaluatorMetadataEntryNames(
  grain: ProjectEvaluatorMappingSourceGrain
): Set<string> {
  return new Set(getEvaluatorMetadataEntries(grain).map(({ name }) => name));
}
