import type { Completion } from "@codemirror/autocomplete";

import { createAIQueryDSL } from "@phoenix/components/filter/ai/createAIQueryDSL";
import type { DSLFilterSnippet } from "@phoenix/components/filter/DSLFilterConditionField";

/**
 * The experiment run filter DSL vocabulary: the fields the typeahead
 * completes, the example snippets it suggests, and the AI query DSL derived
 * from both. Kept free of React and CodeMirror runtime imports so the AI
 * query eval suite can exercise the exact production DSL from Node.
 */

/**
 * The fields of the experiment run filter DSL that an expression can
 * reference. These double as the vocabulary taught to the AI query model,
 * so each `info` string should describe the field well enough to translate
 * plain language into it.
 */
export const experimentRunFilterCompletions: Completion[] = [
  {
    label: "input",
    type: "variable",
    info: "The input of the dataset example, read by key - e.g. input['question']",
  },
  {
    label: "reference_output",
    type: "variable",
    info: "The reference output of the dataset example, read by key - e.g. reference_output['answer']",
  },
  {
    label: "metadata",
    type: "variable",
    info: "The metadata of the dataset example, read by key - e.g. metadata['topic']",
  },
  {
    label: "output",
    type: "variable",
    info: "The output of the experiment run, searchable directly - e.g. 'text' in output",
  },
  {
    label: "error",
    type: "variable",
    info: "The error message of the experiment run (if exists)",
  },
  {
    label: "latency_ms",
    type: "variable",
    info: "The duration of the experiment run in milliseconds",
  },
  {
    label: "evals",
    type: "variable",
    info: "The evaluations of the experiment run, accessed by name",
  },
  {
    label: "experiments",
    type: "variable",
    info: "The experiments being compared, accessed by position - e.g. experiments[0]",
  },
];

/**
 * Example conditions shown as suggestions in the typeahead — notably when
 * the empty field is focused. `${placeholder}` segments become tab-through
 * fields on insert.
 */
export const experimentRunFilterSnippets: DSLFilterSnippet[] = [
  {
    label: "search output for substring",
    snippet: "'${search text}' in output",
  },
  {
    // The dataset example's JSON documents can only be read through a key —
    // the server rejects a bare `input` operand with "Select a key from
    // `input` with [<key>]" — so the snippet carries the subscript.
    label: "search input for substring",
    snippet: "'${search text}' in input['${key}']",
  },
  {
    label: "search reference output for substring",
    snippet: "'${search text}' in reference_output['${key}']",
  },
  {
    label: "filter on errors",
    snippet: "error is not None",
  },
  {
    label: "filter out errors",
    snippet: "error is None",
  },
  {
    label: "filter by evaluation label",
    snippet: "evals['${name}'].label == '${label}'",
  },
  {
    label: "filter by evaluation score",
    snippet: "evals['${name}'].score >= ${0.5}",
  },
  {
    label: "search evaluation explanation",
    snippet: "'${search text}' in evals['${name}'].explanation",
  },
  {
    label: "filter for lower scores than first experiment",
    snippet: "evals['${name}'].score < experiments[0].evals['${name}'].score",
  },
  {
    label: "filter by metadata",
    snippet: "metadata['${key}'] == '${value}'",
  },
  {
    label: "filter by latency",
    snippet: "latency_ms >= ${10_000}",
  },
];

/**
 * Requests phrased the way someone reading an experiment phrases them,
 * paired with the expression each should produce. These teach idiom
 * selection — that a named metric lives under `evals`, which of the three
 * text fields a phrase points at, how experiments are compared — which the
 * field list alone cannot convey.
 *
 * Deliberately disjoint in surface content from
 * `experimentRunFilterCases` in the eval suite: an example that reuses a
 * case's literals turns that case into a recall test and stops measuring
 * translation.
 */
const experimentRunFilterAIExamples = [
  { description: "runs that errored", expression: "error is not None" },
  {
    description: "the completeness eval scored under 0.5",
    expression: "evals['completeness'].score < 0.5",
  },
  {
    description: "runs the tone eval labeled formal",
    expression: "evals['tone'].label == 'formal'",
  },
  {
    description: "runs the coverage eval never scored",
    expression: "evals['coverage'].score is None",
  },
  {
    description: "examples tagged with the legal topic",
    expression: "metadata['topic'] == 'legal'",
  },
  {
    description: "outputs that mention a discount",
    expression: "'discount' in output",
  },
  {
    description: "inputs whose prompt mentions shipping",
    expression: "'shipping' in input['prompt']",
  },
  {
    description: "runs where the reference translation mentions Berlin",
    expression: "'Berlin' in reference_output['translation']",
  },
  {
    description: "errors mentioning quota",
    expression: "'quota' in error",
  },
  {
    description: "runs slower than 20 seconds",
    expression: "latency_ms > 20000",
  },
  {
    description: "runs that took between one and two seconds",
    expression: "latency_ms > 1000 and latency_ms < 2000",
  },
  {
    description: "runs the speed eval labeled fast or medium",
    expression:
      "evals['speed'].label == 'fast' or evals['speed'].label == 'medium'",
  },
  {
    description: "the first experiment beat the second on helpfulness",
    expression:
      "experiments[0].evals['helpfulness'].score > experiments[1].evals['helpfulness'].score",
  },
  {
    // Teaches the no-arithmetic approximation by demonstration: the "by at
    // least 0.1" delta cannot be expressed (no subtraction), so it drops.
    description:
      "runs where fluency fell by at least 0.1 in the second experiment",
    expression:
      "experiments[1].evals['fluency'].score < experiments[0].evals['fluency'].score",
  },
  {
    description: "runs where the two experiments agree on the verdict label",
    expression:
      "experiments[0].evals['verdict'].label == experiments[1].evals['verdict'].label",
  },
];

/**
 * Everything the AI query model needs to translate plain language into the
 * experiment run filter DSL. The field vocabulary is the typeahead's, so
 * the two can never drift apart; the examples are written for translation
 * rather than borrowed from the snippet menu.
 */
export const experimentRunFilterAIQueryDSL = createAIQueryDSL({
  noun: "experiment runs",
  completions: experimentRunFilterCompletions,
  snippets: experimentRunFilterSnippets,
  examples: experimentRunFilterAIExamples,
  notes: [
    "Evaluations are accessed by name, e.g. evals['Hallucination'], and expose .label, .score, and .explanation.",
    "Any name the request scores, labels, or compares is an evaluation reached through evals['<name>'] — including names not listed above. Never restate such a name as latency_ms or another field.",
    "Durations are in milliseconds: five seconds is latency_ms > 5000.",
    "input, reference_output, and metadata belong to the dataset example and are always read through a key — input['question'], metadata['topic'] — never bare. The run's output and error are searched directly: 'text' in output.",
    "When experiments are compared side by side, experiments[i] scopes a field to the i-th experiment: experiments[0].evals['name'].score, experiments[1].latency_ms.",
    "Two experiments are compared by putting one scoped field on each side of a comparison — never by subtracting or dividing them. There is no arithmetic.",
    "An unscoped field matches each run against its own experiment, so 'either experiment' is the unscoped field alone, and 'both experiments' is one experiments[i] clause per experiment joined with and.",
    "Comparisons are binary only: a range is two clauses joined with and, never 1000 < latency_ms < 5000.",
    "There is no list membership: 'a or b' is two equality clauses joined with or, never in ['a', 'b'].",
  ],
});
