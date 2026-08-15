import type { FrontierFilterEvalCase } from "./evalCase";

/**
 * Seeded from a production miss — "filter_correct is less than 1"
 * translated to `latency_ms < 1000` — plus the failure modes the dialect
 * invites: eval names the model has never seen, three near-synonymous text
 * fields, span-DSL vocabulary bleeding in (status_code, span_kind), and
 * the experiments[i] scoping idiom. Prune cases every model exact-matches
 * across repeated runs, the way `spanFilterCases` was pruned.
 *
 * This set hill-climbs two things at once. Cases without a
 * `missingCapability` climb the prompt: they are expressible today, and a
 * miss is a prompt problem. Cases with one climb the language: the query
 * is real, the DSL cannot say it exactly, and the field names the
 * capability that would.
 * Two engineer questions have no case because they have no approximation
 * at all — per-repetition flakiness (no repetition field in the DSL) and
 * aggregates ("the ten worst runs", "average score per experiment", which
 * a row filter cannot rank or fold). If those capabilities land, seed
 * their cases from this comment.
 *
 * Kept disjoint in surface content from the prompt's own examples in
 * `experimentRunFilterDSL`: a case that reuses an example's literals
 * measures recall, not translation.
 */
export const experimentRunFilterCases: FrontierFilterEvalCase[] = [
  {
    id: "unseen-eval-name-score",
    query: "filter_correct is less than 1",
    accepted: ["evals['filter_correct'].score < 1"],
    failureMode:
      "restates an eval name it has never seen as a numeric field it has — the production miss was latency_ms < 1000",
  },
  {
    id: "errored-runs",
    query: "runs that blew up",
    accepted: ["error is not None"],
    failureMode: "reaches for the span dialect's status_code == 'ERROR'",
  },
  {
    id: "error-substring",
    query: "runs that hit a rate limit",
    accepted: [
      "'rate limit' in error",
      "error is not None and 'rate limit' in error",
    ],
    failureMode:
      "searches output or a status field for an error phrase instead of the error message",
  },
  {
    id: "eval-label",
    query: "runs the toxicity eval marked toxic",
    accepted: ["evals['toxicity'].label == 'toxic'"],
    failureMode: "compares the score when the request names a label",
  },
  {
    id: "output-substring",
    query: "outputs that mention a refund",
    accepted: ["'refund' in output"],
    failureMode:
      "picks the wrong one of the three text fields — input, output, reference_output",
  },
  {
    id: "reference-output-substring",
    query: "runs where the expected answer mentions Paris",
    accepted: ["'Paris' in reference_output['answer']"],
    failureMode:
      "searches the run's output when the request points at the example's reference, or reads reference_output bare — the dialect requires a key",
  },
  {
    id: "latency-unit-conversion",
    query: "runs that took over two minutes",
    accepted: ["latency_ms > 120000", "latency_ms > 120_000"],
    failureMode: "leaves the threshold in seconds or minutes",
  },
  {
    id: "experiment-comparison",
    query:
      "runs where the second experiment scored lower than the first on conciseness",
    accepted: [
      "experiments[1].evals['conciseness'].score < experiments[0].evals['conciseness'].score",
      "experiments[0].evals['conciseness'].score > experiments[1].evals['conciseness'].score",
    ],
    failureMode:
      "drops the experiments[i] scoping or counts experiments from 1",
  },
  {
    id: "error-or-low-score",
    query: "runs that errored or scored under 0.3 on relevance",
    accepted: [
      "error is not None or evals['relevance'].score < 0.3",
      "evals['relevance'].score < 0.3 or error is not None",
    ],
    failureMode: "joins with and, or loses one branch of the disjunction",
  },
  {
    id: "example-metadata",
    query: "runs on examples whose difficulty is hard",
    accepted: ["metadata['difficulty'] == 'hard'"],
    failureMode:
      "invents a top-level difficulty field instead of a metadata key",
  },
  // --- Cross-experiment comparisons. The backend compiles each
  // experiments[i] reference against its own aliased run, so two experiments
  // are compared by putting one scoped field on each side of a binary
  // comparison. What it does NOT support shapes the traps below: no
  // arithmetic (ast.BinOp has no visitor), no chained comparisons, no list
  // membership, and an unscoped run field is bound per experiment and OR'd
  // across them.
  {
    id: "latency-regression-between-experiments",
    query: "runs where the second experiment was slower than the first",
    accepted: [
      "experiments[1].latency_ms > experiments[0].latency_ms",
      "experiments[0].latency_ms < experiments[1].latency_ms",
    ],
    failureMode:
      "compares one experiment's latency to a constant instead of to the other experiment's",
  },
  {
    id: "score-drop-no-arithmetic",
    query:
      "runs where correctness dropped by more than 0.2 in the second experiment",
    accepted: [
      "experiments[1].evals['correctness'].score < experiments[0].evals['correctness'].score",
      "experiments[0].evals['correctness'].score > experiments[1].evals['correctness'].score",
    ],
    failureMode:
      "invents score subtraction the language does not have instead of approximating with a direct comparison",
    missingCapability:
      "subtraction between scoped fields — a - b > 0.2 is how engineers separate regression from noise",
  },
  {
    id: "label-disagreement",
    query: "runs where the two experiments disagree on the sentiment label",
    accepted: [
      "experiments[0].evals['sentiment'].label != experiments[1].evals['sentiment'].label",
      "experiments[1].evals['sentiment'].label != experiments[0].evals['sentiment'].label",
    ],
    failureMode:
      "compares scores when the request names labels, or tests one experiment against a literal",
  },
  {
    id: "output-divergence",
    query: "runs where the two experiments produced different outputs",
    accepted: [
      "experiments[0].output != experiments[1].output",
      "experiments[1].output != experiments[0].output",
    ],
    failureMode:
      "leaves output unscoped, which cannot say anything about two experiments at once",
  },
  {
    id: "error-asymmetry",
    query: "runs that errored in the first experiment but not the second",
    accepted: [
      "experiments[0].error is not None and experiments[1].error is None",
      "experiments[1].error is None and experiments[0].error is not None",
    ],
    failureMode:
      "drops one side of the asymmetry, or negates the wrong experiment",
  },
  {
    id: "both-experiments-slow",
    query: "runs where both experiments took over ten seconds",
    accepted: [
      "experiments[0].latency_ms > 10000 and experiments[1].latency_ms > 10000",
      "experiments[1].latency_ms > 10000 and experiments[0].latency_ms > 10000",
    ],
    failureMode:
      "leaves latency_ms unscoped — an unscoped field is OR'd across experiments, which asks whether either was slow, not both",
  },
  {
    id: "latency-range-no-chaining",
    query: "runs that took between five and ten seconds",
    // "Between" does not fix boundary inclusivity, so every combination of
    // strict and inclusive bounds is a faithful reading.
    accepted: [
      "latency_ms > 5000 and latency_ms < 10000",
      "latency_ms >= 5000 and latency_ms <= 10000",
      "latency_ms >= 5000 and latency_ms < 10000",
      "latency_ms > 5000 and latency_ms <= 10000",
      "latency_ms < 10000 and latency_ms > 5000",
      "latency_ms <= 10000 and latency_ms >= 5000",
      "latency_ms < 10000 and latency_ms >= 5000",
      "latency_ms <= 10000 and latency_ms > 5000",
    ],
    failureMode:
      "chains the range like the span dialect — 5000 < latency_ms < 10000 — which this dialect rejects",
  },
  {
    id: "label-membership-trap",
    query: "runs the quality eval graded excellent or good",
    accepted: [
      "evals['quality'].label == 'excellent' or evals['quality'].label == 'good'",
      "evals['quality'].label == 'good' or evals['quality'].label == 'excellent'",
    ],
    failureMode:
      "tests the label against a list like the span dialect — in ['excellent', 'good'] — which this dialect rejects",
  },
  {
    id: "keyed-example-input",
    query: "runs whose input question mentions a visa",
    accepted: ["'visa' in input['question']"],
    failureMode:
      "searches bare input, which the dialect rejects without a key selected",
  },
  // --- Regression-triage questions, phrased the way an AI engineer reading
  // an experiment comparison asks them: what regressed, what was traded for
  // what, whether the judge can be trusted, and which run of several won.
  {
    id: "label-flip-regression",
    // The labels are pinned in the query ("labeled pass", "labeled fail"):
    // with verb phrasing ("runs that passed"), 'passed'/'failed' were
    // equally fair readings and the case graded morphology, not the flip.
    query:
      "runs the grammar eval labeled pass in the first experiment but labeled fail in the second",
    accepted: [
      "experiments[0].evals['grammar'].label == 'pass' and experiments[1].evals['grammar'].label == 'fail'",
      "experiments[1].evals['grammar'].label == 'fail' and experiments[0].evals['grammar'].label == 'pass'",
    ],
    failureMode:
      "collapses the pass-to-fail transition into one unscoped label test, losing the direction of the flip",
  },
  {
    id: "tradeoff-improved-but-slower",
    query:
      "runs where accuracy improved in the second experiment but latency got worse",
    accepted: [
      "experiments[1].evals['accuracy'].score > experiments[0].evals['accuracy'].score and experiments[1].latency_ms > experiments[0].latency_ms",
      "experiments[1].latency_ms > experiments[0].latency_ms and experiments[1].evals['accuracy'].score > experiments[0].evals['accuracy'].score",
    ],
    failureMode:
      "drops one axis of the tradeoff, or points both comparisons the same direction",
  },
  {
    id: "judge-human-disagreement",
    query: "runs where the llm_judge and human labels disagree",
    accepted: [
      "evals['llm_judge'].label != evals['human'].label",
      "evals['human'].label != evals['llm_judge'].label",
    ],
    failureMode:
      "reaches for experiments[i] when the request compares two evals on the same run",
  },
  {
    id: "answer-changed-score-same",
    query:
      "runs where the output changed between the experiments but the coherence score didn't",
    accepted: [
      "experiments[0].output != experiments[1].output and experiments[0].evals['coherence'].score == experiments[1].evals['coherence'].score",
      "experiments[0].evals['coherence'].score == experiments[1].evals['coherence'].score and experiments[0].output != experiments[1].output",
    ],
    failureMode:
      "attaches 'didn't change' to the wrong field, or drops one conjunct of a two-part observation",
  },
  {
    id: "third-experiment-beats-both",
    query:
      "runs where the third experiment scored higher on faithfulness than both the first and the second",
    accepted: [
      "experiments[2].evals['faithfulness'].score > experiments[0].evals['faithfulness'].score and experiments[2].evals['faithfulness'].score > experiments[1].evals['faithfulness'].score",
      "experiments[2].evals['faithfulness'].score > experiments[1].evals['faithfulness'].score and experiments[2].evals['faithfulness'].score > experiments[0].evals['faithfulness'].score",
    ],
    failureMode:
      "stops after one comparison, or invents a max() the language does not have",
  },
  {
    id: "either-experiment-errored",
    query: "runs where either experiment errored",
    accepted: [
      "error is not None",
      "experiments[0].error is not None or experiments[1].error is not None",
      "experiments[1].error is not None or experiments[0].error is not None",
    ],
    failureMode:
      "does not know an unscoped field already means any compared experiment, or joins the scoped clauses with and",
  },
  {
    id: "judge-explanation-mining",
    query:
      "runs where the groundedness explanation mentions a missing citation",
    accepted: ["'missing citation' in evals['groundedness'].explanation"],
    failureMode: "searches the output or the label instead of the explanation",
  },
  {
    id: "unscored-runs",
    query: "runs the safety eval never scored",
    accepted: ["evals['safety'].score is None"],
    failureMode:
      "writes a bare evals['safety'] existence test, which this dialect rejects in boolean position",
  },
  {
    id: "latency-ratio-frontier",
    query:
      "runs where the second experiment was at least twice as slow as the first",
    accepted: [
      "experiments[1].latency_ms > experiments[0].latency_ms",
      "experiments[0].latency_ms < experiments[1].latency_ms",
    ],
    failureMode:
      "invents multiplication the language does not have instead of approximating with a direct comparison",
    missingCapability:
      "multiplication in comparisons — b > 2 * a is how engineers ask for at-least-2x regressions",
  },
];
