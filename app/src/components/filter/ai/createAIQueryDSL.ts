import type { Completion } from "@codemirror/autocomplete";

import type { DSLFilterSnippet } from "../DSLFilterConditionField";
import type { AIQueryDSL, AIQueryExample } from "./types";

/**
 * Derives the model-facing DSL description from the same completions that
 * power a filter field's typeahead, so the vocabulary the model learns and
 * the vocabulary the user autocompletes can never drift apart.
 *
 * Examples fall back to the typeahead snippets, whose placeholders (`${...}`)
 * become plain text exactly as the typeahead renders them. A snippet label is
 * written for a menu — "filter by errors" — not as a sentence anyone types,
 * so a DSL that cares how well it translates supplies `examples` of its own:
 * requests phrased the way users phrase them, paired with the expression each
 * one should produce. Only the examples are overridden; the field vocabulary,
 * which is what actually drifts, still comes from the completions.
 */
export function createAIQueryDSL({
  noun,
  completions,
  snippets,
  examples,
  notes,
}: {
  noun: string;
  completions: Completion[];
  snippets: DSLFilterSnippet[];
  examples?: AIQueryExample[];
  notes?: string[];
}): AIQueryDSL {
  return {
    noun,
    fields: completions.map((completion) => ({
      name: completion.label,
      description:
        typeof completion.info === "string" ? completion.info : undefined,
    })),
    examples:
      examples ??
      snippets.map((snippet) => ({
        description: snippet.label,
        expression: snippet.snippet.replace(/\$\{([^{}]*)\}/g, "$1"),
      })),
    notes,
  };
}
