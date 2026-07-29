import type { Completion, CompletionSection } from "@codemirror/autocomplete";
import { useCallback, useMemo } from "react";

import {
  type DSLFilterCompletionRequest,
  DSLFilterConditionField,
  type DSLFilterSnippet,
  detectDSLFilterComprehensionScope,
  findDSLFilterComprehensionRange,
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
  /**
   * The collection whose elements expose this name, or null for a term that
   * binds at the session grain. An element term is only writable inside a
   * comprehension over that collection, qualified by the loop variable.
   */
  readonly iterableName?: string | null;
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
  iterable: { name: "Collections", rank: 8 },
};

/**
 * Element fields replace the whole dropdown inside a comprehension, so they
 * need only one group of their own.
 */
const elementFieldsSection: CompletionSection = { name: "Fields", rank: 1 };

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
    label: "any span errored",
    snippet: 'any(s.status_code == "ERROR" for s in spans)',
  },
  {
    label: "any span matches a condition",
    snippet: "any(${s.latency_ms > 1000} for s in ${spans})",
  },
  {
    label: "all spans match a condition",
    snippet: "all(${s.latency_ms < 1000} for s in ${spans})",
  },
  {
    label: "count spans matching a condition",
    snippet: 'len([s for s in spans if s.span_kind == "${TOOL}"]) >= ${2}',
  },
  {
    label: "slowest span in the session",
    snippet: "max(s.latency_ms for s in spans) > ${5_000}",
  },
  {
    label: "any turn matches a condition",
    snippet: "any(${t.latency_ms > 10_000} for t in ${turns})",
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

/**
 * An element field is only ever written qualified by the comprehension's loop
 * variable, so it is offered that way — completing `s.latency_ms`, never a
 * bare `latency_ms` the compiler would reject.
 */
function getElementCompletionOption(
  term: SessionFilterVocabularyTerm,
  loopVariable: string
): Completion {
  return {
    label: `${loopVariable}.${term.name}`,
    type: "variable",
    detail: term.type,
    info: term.description,
    section: elementFieldsSection,
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

  // Element fields are split out of the top-level vocabulary: offering
  // `latency_ms` bare would complete a condition the compiler rejects, since
  // it only binds inside a comprehension over the collection that exposes it.
  const { completions, elementTermsByIterable, iterableNames } = useMemo(() => {
    const topLevelTerms: SessionFilterVocabularyTerm[] = [];
    const elementTerms = new Map<string, SessionFilterVocabularyTerm[]>();
    const collections = new Set<string>();

    for (const term of vocabulary) {
      if (term.category === "iterable") {
        collections.add(term.name);
      }
      if (term.iterableName) {
        const terms = elementTerms.get(term.iterableName) ?? [];
        terms.push(term);
        elementTerms.set(term.iterableName, terms);
      } else {
        topLevelTerms.push(term);
      }
    }

    return {
      // Section-rank order: the field caps the browse view, so the core
      // vocabulary has to come before observed names
      completions: topLevelTerms
        .map(getCompletionOption)
        .sort(compareBySectionRank),
      elementTermsByIterable: elementTerms,
      iterableNames: collections,
    };
  }, [vocabulary]);

  // Inside a comprehension the loop variable's fields are the only writable
  // names, so they replace the dropdown rather than joining it. An
  // unclassifiable cursor returns null and completion behaves as it always has.
  const getContextualCompletions = useCallback(
    ({ textBeforeCursor, textAfterCursor }: DSLFilterCompletionRequest) => {
      const scope = detectDSLFilterComprehensionScope({
        textBeforeCursor,
        textAfterCursor,
        isIterableName: (name) => iterableNames.has(name),
      });
      if (!scope) {
        return null;
      }
      const terms = elementTermsByIterable.get(scope.iterableName);
      return terms
        ? terms.map((term) =>
            getElementCompletionOption(term, scope.loopVariable)
          )
        : null;
    },
    [iterableNames, elementTermsByIterable]
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
      getContextualCompletions={getContextualCompletions}
      getErrorRange={findDSLFilterComprehensionRange}
      validateCondition={validateCondition}
      onValidCondition={handleValidCondition}
    />
  );
}
