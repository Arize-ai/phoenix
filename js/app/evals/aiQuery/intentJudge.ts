import { createClassificationEvaluator } from "@arizeai/phoenix-evals";
import type { LanguageModel } from "ai";

import { formatAIQueryFieldLines } from "@phoenix/components/filter/ai/buildAIQueryPrompt";
import type { AIQueryDSL } from "@phoenix/components/filter/ai/types";

import { evalTracer } from "./telemetry";

export type FilterIntentRecord = {
  query: string;
  expression: string;
  /** What the user is actually hunting. */
  phenomenon: string;
  /** The field(s) where data exhibiting the phenomenon lives, comma-joined. */
  expectedFields: string;
  /** Illustrative surface forms matching data would contain, comma-joined. */
  surfaceForms: string;
};

/**
 * An LLM judge that decides whether a generated expression captures the
 * intent of a request — searching the right side of the conversation for
 * text the phenomenon actually leaves in the data — rather than echoing
 * the request's own wording. The complement of the equivalence judge:
 * that one grades against reference expressions; this one grades against
 * a described phenomenon, because expansion has no single right answer.
 */
export function createFilterIntentJudge({
  model,
  dsl,
}: {
  model: LanguageModel;
  dsl: AIQueryDSL;
}) {
  const fieldLines = formatAIQueryFieldLines(dsl);
  return createClassificationEvaluator<FilterIntentRecord>({
    name: "filter_intent",
    model,
    // The shared tracer keeps the judge's call traced once: phoenix-evals
    // sees the global integration already carries it and appends nothing.
    telemetry: { tracer: evalTracer },
    choices: { captures_intent: 1, misses_intent: 0 },
    promptTemplate: `You judge whether a filter expression captures the INTENT of a natural-language request over ${dsl.noun}. A filter is a Python-like boolean expression evaluated against each of the ${dsl.noun}; substring search is written \`'text' in field\` and is case-sensitive.

An expression may reference only these fields:
${fieldLines}

The request: {{query}}

What the user is hunting: {{phenomenon}}

The data exhibiting it lives in: {{expectedFields}}

Text exhibiting it would contain surface forms such as: {{surfaceForms}} (illustrative, not exhaustive or required).

The candidate expression: {{expression}}

Label the candidate "captures_intent" when it would actually surface the phenomenon in real data:
- It searches (at least) one of the expected fields, not some other part of the span.
- Its search terms are text that would appear in the data itself — surface forms, root forms, or synonyms like the ones listed, alone or combined with \`or\`. A root form covering several variants (e.g. 'apolog' for apology/apologize/apologies) is good, and a single well-chosen term is enough when it would genuinely appear in matching data.

Label it "misses_intent" when the candidate:
- searches the wrong field — e.g. reads the input when the phenomenon lives in the response, or vice versa; or
- merely echoes the request's own abstract wording as the search term when that wording would not appear in matching data (searching responses for 'apology' finds essays about apologies, not apologies); or
- filters on an annotation, attribute, or value the request never gave, standing in for a search of the data; or
- is so broad, empty, or generic that it matches ${dsl.noun} regardless of the phenomenon.`,
  });
}
