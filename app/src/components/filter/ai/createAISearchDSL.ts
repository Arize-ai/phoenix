import type { Completion } from "@codemirror/autocomplete";

import type { DSLFilterSnippet } from "../DSLFilterConditionField";
import type { AISearchDSL } from "./types";

/**
 * Derives the model-facing DSL description from the same completions and
 * snippets that power a filter field's typeahead, so the vocabulary the
 * model learns and the vocabulary the user autocompletes can never drift
 * apart. Snippet placeholders (`${...}`) become plain text, exactly as the
 * typeahead renders them.
 */
export function createAISearchDSL({
  noun,
  completions,
  snippets,
  notes,
}: {
  noun: string;
  completions: Completion[];
  snippets: DSLFilterSnippet[];
  notes?: string[];
}): AISearchDSL {
  return {
    noun,
    fields: completions.map((completion) => ({
      name: completion.label,
      description:
        typeof completion.info === "string" ? completion.info : undefined,
    })),
    examples: snippets.map((snippet) => ({
      description: snippet.label,
      expression: snippet.snippet.replace(/\$\{([^{}]*)\}/g, "$1"),
    })),
    notes,
  };
}
