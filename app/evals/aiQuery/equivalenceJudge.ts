import { createClassificationEvaluator } from "@arizeai/phoenix-evals";
import type { LanguageModel } from "ai";

import {
  formatAIQueryFieldLines,
  formatAIQueryNoteLines,
} from "@phoenix/components/filter/ai/buildAIQueryPrompt";
import type { AIQueryDSL } from "@phoenix/components/filter/ai/types";

import { evalTracer } from "./telemetry";

export type FilterEquivalenceRecord = {
  query: string;
  expression: string;
  /** The accepted reference expressions, one bulleted line each. */
  references: string;
};

/**
 * An LLM judge that decides whether a generated expression filters the same
 * spans as one of a case's accepted reference expressions — catching
 * legitimate variation (clause order, equivalent operators) that the
 * normalized exact-match check cannot. The rubric is built from the DSL
 * data rather than the system prompt under test, so hill-climbing the
 * prompt never shifts the grading.
 */
export function createFilterEquivalenceJudge({
  model,
  dsl,
}: {
  model: LanguageModel;
  dsl: AIQueryDSL;
}) {
  const fieldLines = formatAIQueryFieldLines(dsl);
  // The dialect's notes go into the rubric so the judge can reject a
  // candidate that is logically equivalent but written in syntax this
  // dialect rejects (list membership, chained ranges, arithmetic) — the
  // server would refuse it, so the eval must not count it correct.
  const notes = dsl.notes?.length
    ? `\nNotes on this dialect:\n${formatAIQueryNoteLines(dsl)}\n`
    : "";
  return createClassificationEvaluator<FilterEquivalenceRecord>({
    name: "filter_equivalence",
    model,
    // The shared tracer keeps the judge's call traced once: phoenix-evals
    // sees the global integration already carries it and appends nothing.
    telemetry: { tracer: evalTracer },
    choices: { equivalent: 1, not_equivalent: 0 },
    promptTemplate: `You judge translations of natural-language requests into a filter DSL for ${dsl.noun}: a Python-like boolean expression evaluated against each of the ${dsl.noun}. String literals use single quotes; clauses combine with \`and\`, \`or\`, and \`not\`; substring search is written \`'text' in field\`.

An expression may reference only these fields:
${fieldLines}
${notes}
The request: {{query}}

The candidate expression: {{expression}}

Known-correct reference expressions:
{{references}}

Label the candidate "equivalent" when it would keep the same ${dsl.noun} as one of the references — differences in clause order, quoting, or logically interchangeable operators are fine. Label it "not_equivalent" if it references fields outside the list, uses a construct the notes say this dialect does not support (even when the logic matches), changes a compared value or threshold, or filters different behavior than the request asks for.`,
  });
}
