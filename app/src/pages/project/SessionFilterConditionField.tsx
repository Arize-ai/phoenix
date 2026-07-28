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
 * Ranks continue past the field's own built-in sections — Recent searches (0),
 * Suggestions (1), loaded (2), Fields (3) — see `DSLFilterConditionField`.
 */
const vocabularyCategorySections: Record<string, CompletionSection> = {
  session: { name: "Session", rank: 4 },
  aggregate: { name: "Aggregates", rank: 5 },
  attribute: { name: "Attributes", rank: 6 },
  annotation: { name: "Annotations", rank: 7 },
};

/**
 * Example conditions for the typeahead's "Suggestions" group, ordered
 * most-useful-first. `${placeholder}` segments become tab-through fields on
 * insert; subscripted names use double quotes to match the served vocabulary.
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
    label: "filter by session id",
    snippet: "session_id == '${session id}'",
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
    snippet: "tool_span_count > 0",
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
];

function getCompletionOption(term: SessionFilterVocabularyTerm): Completion {
  return {
    label: term.name,
    type: "variable",
    // `detail` renders right-aligned in the dropdown; the category is
    // conveyed by the section header
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

  // Section-rank order: the field caps the browse view, so the core
  // vocabulary has to come before observed names
  const completions = useMemo(
    () => vocabulary.map(getCompletionOption).sort(compareBySectionRank),
    [vocabulary]
  );

  // Stable identity: the field's validation effect keys on `validateCondition`
  const validateCondition = useCallback(
    (condition: string) => validateSessionFilterCondition(condition, projectId),
    [projectId]
  );

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
