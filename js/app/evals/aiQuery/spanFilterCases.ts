import type { FilterEvalCase } from "./evalCase";

/**
 * The hill-climbing set: requests phrased the way someone debugging an agent
 * phrases them, chosen so that each one can fail for a specific, nameable
 * reason. A case earns its slot by missing: every case here was answered
 * wrong by at least one model in the eval matrix across repeated runs, and
 * cases every model exact-matched in every run were retired (they cost a
 * round trip per run and moved no decision — git history keeps them).
 *
 * What makes a case hard here is never a guess. Thresholds are stated in the
 * request or fixed by the prompt's stated default for "slow", and keys and
 * annotation names appear verbatim in the request, so a wrong answer is a
 * wrong *translation* — the wrong field out of two near-synonyms, a missed
 * clause, an idiom the model doesn't know — rather than a coin flip the
 * grader happened to call. The two places genuine ambiguity survives
 * (`empty-retriever-output`, `top-n-approximation`) list every reasonable
 * reading in `accepted`.
 *
 * Kept disjoint in surface content from the prompt's own examples in
 * `spanFilterDSL`: a case that reuses an example's literals measures recall,
 * not translation.
 */
export const spanFilterCases: FilterEvalCase[] = [
  {
    id: "llm-bad-feedback",
    query: "llm spans where the user_feedback was bad",
    accepted: [
      "span_kind == 'LLM' and annotations['user_feedback'].label == 'bad'",
      "annotations['user_feedback'].label == 'bad' and span_kind == 'LLM'",
      "span_kind == 'LLM' and evals['user_feedback'].label == 'bad'",
      "evals['user_feedback'].label == 'bad' and span_kind == 'LLM'",
    ],
    failureMode:
      "scores the annotation instead of reading its label, or reaches for metadata['user_feedback']",
  },
  {
    id: "tool-timeouts",
    query: "which tool calls timed out",
    accepted: [
      "span_kind == 'TOOL' and 'timeout' in status_message",
      "'timeout' in status_message and span_kind == 'TOOL'",
    ],
    failureMode:
      "puts the timeout in status_code, or hedges with extra alternative clauses the request never asked for",
  },
  {
    id: "empty-retriever-output",
    query: "retrievers that came back with nothing",
    accepted: [
      "span_kind == 'RETRIEVER' and output.value is None",
      "output.value is None and span_kind == 'RETRIEVER'",
      "span_kind == 'RETRIEVER' and output.value == ''",
      "output.value == '' and span_kind == 'RETRIEVER'",
    ],
    failureMode: "has no spelling for emptiness on a text field",
  },
  {
    id: "has-groundedness-annotation",
    query: "spans that have a groundedness annotation at all",
    accepted: ["annotations['groundedness']", "evals['groundedness']"],
    failureMode:
      "invents a comparison because a bare annotation looks like a value, not a condition",
  },
  {
    id: "kind-exclusion",
    query: "everything that isn't an embedding or llm span",
    accepted: [
      "span_kind not in ['EMBEDDING', 'LLM']",
      "span_kind not in ['LLM', 'EMBEDDING']",
      "span_kind != 'EMBEDDING' and span_kind != 'LLM'",
      "span_kind != 'LLM' and span_kind != 'EMBEDDING'",
    ],
    failureMode:
      "distributes the negation as `or`, which keeps every span in the project",
  },
  {
    id: "name-membership-errors",
    query: "failures in either fetch_orders or query_db",
    accepted: [
      "status_code == 'ERROR' and name in ['fetch_orders', 'query_db']",
      "status_code == 'ERROR' and name in ['query_db', 'fetch_orders']",
      "status_code == 'ERROR' and (name == 'fetch_orders' or name == 'query_db')",
      "(name == 'fetch_orders' or name == 'query_db') and status_code == 'ERROR'",
      "name in ['fetch_orders', 'query_db'] and status_code == 'ERROR'",
    ],
    failureMode:
      "drops the parentheses when mixing and with or, silently widening the filter",
  },
  {
    id: "model-family-substring",
    query: "any gpt-4 variant",
    accepted: ["'gpt-4' in llm.model_name"],
    failureMode:
      "tests equality against a family name that no single model reports",
  },
  {
    id: "tool-name-attribute",
    query: "calls to the search_docs tool",
    accepted: [
      "attributes['tool']['name'] == 'search_docs'",
      "tool.name == 'search_docs'",
    ],
    failureMode:
      "flattens the dotted attribute into one subscript, attributes['tool.name']",
  },
  {
    id: "annotation-explanation-substring",
    query: "spans where the correctness explanation mentions ambiguous",
    accepted: [
      "'ambiguous' in annotations['correctness'].explanation",
      "'ambiguous' in evals['correctness'].explanation",
    ],
    failureMode: "searches the label or the output rather than the explanation",
  },
  {
    id: "rate-limit-errors",
    query: "rate limit errors",
    accepted: [
      "status_code == 'ERROR' and 'rate limit' in status_message",
      "'rate limit' in status_message and status_code == 'ERROR'",
    ],
    failureMode:
      "splits one phrase across status_code and status_message, or won't",
  },
  {
    id: "slow-default-threshold",
    query: "the slowest agent steps",
    accepted: [
      "span_kind == 'AGENT' and latency_ms > 10000",
      "latency_ms > 10000 and span_kind == 'AGENT'",
    ],
    failureMode:
      "leaves an unstated threshold out, or picks one the prompt didn't define",
  },
  {
    id: "session-attribute",
    query: "everything from session abc-123",
    accepted: [
      "attributes['session']['id'] == 'abc-123'",
      "session.id == 'abc-123'",
      "metadata['session_id'] == 'abc-123'",
    ],
    failureMode:
      "flattens the session path into one subscript, attributes['session.id']",
  },
  {
    id: "token-ratio-arithmetic",
    query: "spans where the completion was more than half of the total tokens",
    accepted: [
      "llm.token_count.completion / llm.token_count.total > 0.5",
      "llm.token_count.completion > llm.token_count.total / 2",
      "llm.token_count.completion > (llm.token_count.total / 2)",
      "llm.token_count.completion > 0.5 * llm.token_count.total",
    ],
    failureMode: "does not know two fields can be compared arithmetically",
  },
  {
    id: "top-n-approximation",
    query: "the five slowest spans",
    accepted: ["latency_ms > 10000"],
    failureMode:
      "invents ordering or a limit the language does not have, instead of approximating with the default slow threshold",
  },
];
