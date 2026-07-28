import type { Completion, CompletionSection } from "@codemirror/autocomplete";
import { useCallback, useMemo } from "react";

import {
  DSLFilterConditionField,
  type DSLFilterSnippet,
  useDSLFilterConditionHistory,
} from "@phoenix/components/filter";
import { useTracingContext } from "@phoenix/contexts/TracingContext";

import { useSessionFilters } from "./SessionFiltersContext";
import { validateSessionFilterCondition } from "./sessionFilterValidation";

export type SessionFilterVocabularyTerm = {
  readonly name: string;
  readonly type: string;
  readonly description: string;
  readonly category: string;
};

/**
 * Typeahead sections for the served vocabulary categories, in display order
 * after the built-in Recent searches (0) and Suggestions (1) groups. Ranks
 * skip the field's own loaded (2) and Fields (3) ranks so an unknown
 * category — a newer server may serve one — degrades into the generic
 * "Fields" group above these rather than colliding with one of them.
 */
const vocabularyCategorySections: Record<string, CompletionSection> = {
  session: { name: "Session", rank: 4 },
  aggregate: { name: "Aggregates", rank: 5 },
  attribute: { name: "Attributes", rank: 6 },
  annotation: { name: "Annotations", rank: 7 },
};

/**
 * Example conditions shown as a "Suggestions" group in the typeahead —
 * notably when the empty field is focused. `${placeholder}` segments become
 * tab-through fields on insert. Ordered most-useful-first: only the first
 * few show while browsing; the rest surface via fuzzy matching as the user
 * types. Subscripted names use double quotes to match the served vocabulary,
 * so a snippet reads the same as an accepted completion.
 */
const sessionFilterSnippets: DSLFilterSnippet[] = [
  {
    label: "filter by number of turns",
    snippet: "num_traces >= ${5}",
  },
  {
    label: "filter by errors",
    snippet: "num_traces_with_error > 0",
  },
  {
    label: "search inputs for substring",
    snippet: "'${search text}' in any_input",
  },
  {
    label: "search outputs for substring",
    snippet: "'${search text}' in any_output",
  },
  {
    label: "filter by duration",
    snippet: "duration_ms >= ${10_000}",
  },
  {
    label: "filter by annotation score",
    snippet: 'annotations["${name}"].score >= ${0.5}',
  },
  {
    label: "filter by tool usage",
    snippet: 'tool_call_count["${tool name}"] > 0',
  },
  {
    label: "filter by total tokens",
    snippet: "token_count_total > ${1_000}",
  },
  {
    label: "filter by total cost",
    snippet: "total_cost > ${1}",
  },
  {
    label: "filter by annotation label",
    snippet: "annotations[\"${name}\"].label == '${label}'",
  },
  {
    label: "filter by metadata",
    snippet: "metadata[\"${key}\"] == '${value}'",
  },
  {
    label: "filter by user",
    snippet: "user.id == '${user id}'",
  },
  {
    label: "filter by session id",
    snippet: "session_id == '${session id}'",
  },
];

function getCompletionOption(term: SessionFilterVocabularyTerm): Completion {
  return {
    label: term.name,
    type: "variable",
    // The comparand's value type (string / number / datetime) renders
    // right-aligned in the dropdown as a hint for how to write the
    // comparison; the category itself is conveyed by the section header
    detail: term.type,
    info: term.description,
    section: vocabularyCategorySections[term.category],
  };
}

function getSectionRank(completion: Completion): number {
  return typeof completion.section === "object" &&
    typeof completion.section.rank === "number"
    ? completion.section.rank
    : Number.MAX_SAFE_INTEGER;
}

function compareBySectionRank(a: Completion, b: Completion): number {
  return getSectionRank(a) - getSectionRank(b);
}

type SessionFilterConditionFieldProps = {
  onValidCondition: (condition: string) => void;
  vocabulary: readonly SessionFilterVocabularyTerm[];
  placeholder?: string;
};

export function SessionFilterConditionField(
  props: SessionFilterConditionFieldProps
) {
  const {
    onValidCondition,
    vocabulary,
    placeholder = "filter condition (e.x. num_traces >= 5)",
  } = props;
  const { filterCondition, setFilterCondition } = useSessionFilters();
  const projectId = useTracingContext((state) => state.projectId);

  // Ordered by section rank so the capped browse view (empty field focused)
  // spends its rows on the core vocabulary before observed names
  const completions = useMemo(
    () => vocabulary.map(getCompletionOption).sort(compareBySectionRank),
    [vocabulary]
  );

  // Stable identity: the field's validation effect keys on validateCondition,
  // so an unstable identity would re-run validation every render
  const validateCondition = useCallback(
    (condition: string) => validateSessionFilterCondition(condition, projectId),
    [projectId]
  );

  // Recent searches are keyed per project rather than globally: session
  // filter expressions routinely reference project-specific names
  // (annotations, tool names, attribute paths), so another project's history
  // would be noise
  const {
    completionSource: recentSearchesCompletionSource,
    recordValidCondition,
  } = useDSLFilterConditionHistory({
    historyKey: `session-filter-${projectId}`,
  });

  const completionSources = useMemo(
    () => [recentSearchesCompletionSource],
    [recentSearchesCompletionSource]
  );

  const handleValidCondition = useCallback(
    (condition: string) => {
      recordValidCondition(condition);
      onValidCondition(condition);
    },
    [recordValidCondition, onValidCondition]
  );

  // Session filters cannot yet be advertised through AgentContext: the shared
  // project context contract only exposes `spanFilter`. Reusing that field
  // would describe this session expression as a span expression to PXI.
  return (
    <DSLFilterConditionField
      aria-label="Filter sessions"
      className="session-filter-condition-field"
      value={filterCondition}
      onChange={setFilterCondition}
      placeholder={placeholder}
      completions={completions}
      snippets={sessionFilterSnippets}
      completionSources={completionSources}
      validateCondition={validateCondition}
      onValidCondition={handleValidCondition}
    />
  );
}
