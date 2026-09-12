import type {
  AIQueryExample,
  AIQueryField,
} from "@phoenix/components/filter/ai/types";

import { spanFilterAIQueryDSL } from "./spanFilterDSL";

/**
 * The span filter DSL as reference material for an agent that writes a filter
 * on the user's behalf: the same fields, dialect notes, and translation
 * examples the in-browser AI query model learns from, so there is one source
 * of truth for what a filter may say and this module only reshapes it.
 */
export type SpanFilterHelp = {
  fields: AIQueryField[];
  notes: string[];
  examples: AIQueryExample[];
};

export function getSpanFilterHelp(
  dsl: Pick<
    typeof spanFilterAIQueryDSL,
    "fields" | "notes" | "examples"
  > = spanFilterAIQueryDSL
): SpanFilterHelp {
  return {
    fields: dsl.fields,
    notes: dsl.notes ?? [],
    examples: dsl.examples,
  };
}

const DEFAULT_EXAMPLE_LIMIT = 4;

/**
 * A one-line taste of the DSL for an operation description, e.g.
 * `errors → status_code == 'ERROR'; ...`. The full reference is a read away,
 * so the description stays short enough for a catalog that is returned whole.
 */
export function formatSpanFilterExampleSummary({
  examples = spanFilterAIQueryDSL.examples,
  limit = DEFAULT_EXAMPLE_LIMIT,
}: {
  examples?: AIQueryExample[];
  /** How many examples to show. */
  limit?: number;
} = {}): string {
  return examples
    .slice(0, limit)
    .map((example) => `${example.description} → ${example.expression}`)
    .join("; ");
}
