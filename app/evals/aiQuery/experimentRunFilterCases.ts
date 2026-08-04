/**
 * A natural-language request paired with the experiment run filter
 * expressions accepted as correct translations. The first accepted
 * expression is the canonical answer; the rest are alternative phrasings
 * that filter the same runs (clause order, equivalent fields). Anything
 * else falls through to the LLM equivalence judge.
 */
export type ExperimentRunFilterEvalCase = {
  /** Stable example id — keeps experiment runs upserting onto the same dataset example. */
  id: string;
  /** The natural-language request a user would type. */
  query: string;
  /** Expressions accepted as (normalized) exact matches. */
  accepted: string[];
  /**
   * The one thing this case isolates — the reason it earns a slot. Read it
   * as "the case fails when the model ...".
   */
  probes: string;
};

/**
 * Seeded from a production miss — "filter_correct is less than 1"
 * translated to `latency_ms < 1000` — plus the failure modes the dialect
 * invites: eval names the model has never seen, three near-synonymous text
 * fields, span-DSL vocabulary bleeding in (status_code, span_kind), and
 * the experiments[i] scoping idiom. Prune cases every model exact-matches
 * across repeated runs, the way `spanFilterCases` was pruned.
 *
 * Kept disjoint in surface content from the prompt's own examples in
 * `experimentRunFilterDSL`: a case that reuses an example's literals
 * measures recall, not translation.
 */
export const experimentRunFilterCases: ExperimentRunFilterEvalCase[] = [
  {
    id: "unseen-eval-name-score",
    query: "filter_correct is less than 1",
    accepted: ["evals['filter_correct'].score < 1"],
    probes:
      "restates an eval name it has never seen as a numeric field it has — the production miss was latency_ms < 1000",
  },
  {
    id: "errored-runs",
    query: "runs that blew up",
    accepted: ["error is not None"],
    probes: "reaches for the span dialect's status_code == 'ERROR'",
  },
  {
    id: "error-substring",
    query: "runs that hit a rate limit",
    accepted: [
      "'rate limit' in error",
      "error is not None and 'rate limit' in error",
    ],
    probes:
      "searches output or a status field for an error phrase instead of the error message",
  },
  {
    id: "eval-label",
    query: "runs the toxicity eval marked toxic",
    accepted: ["evals['toxicity'].label == 'toxic'"],
    probes: "compares the score when the request names a label",
  },
  {
    id: "output-substring",
    query: "outputs that mention a refund",
    accepted: ["'refund' in output"],
    probes:
      "picks the wrong one of the three text fields — input, output, reference_output",
  },
  {
    id: "reference-output-substring",
    query: "runs where the expected answer mentions Paris",
    accepted: ["'Paris' in reference_output"],
    probes:
      "searches the run's output when the request points at the example's reference",
  },
  {
    id: "latency-unit-conversion",
    query: "runs that took over two minutes",
    accepted: ["latency_ms > 120000", "latency_ms > 120_000"],
    probes: "leaves the threshold in seconds or minutes",
  },
  {
    id: "experiment-comparison",
    query:
      "runs where the second experiment scored lower than the first on conciseness",
    accepted: [
      "experiments[1].evals['conciseness'].score < experiments[0].evals['conciseness'].score",
      "experiments[0].evals['conciseness'].score > experiments[1].evals['conciseness'].score",
    ],
    probes: "drops the experiments[i] scoping or counts experiments from 1",
  },
  {
    id: "error-or-low-score",
    query: "runs that errored or scored under 0.3 on relevance",
    accepted: [
      "error is not None or evals['relevance'].score < 0.3",
      "evals['relevance'].score < 0.3 or error is not None",
    ],
    probes: "joins with and, or loses one branch of the disjunction",
  },
  {
    id: "example-metadata",
    query: "runs on examples whose difficulty is hard",
    accepted: ["metadata['difficulty'] == 'hard'"],
    probes: "invents a top-level difficulty field instead of a metadata key",
  },
];
