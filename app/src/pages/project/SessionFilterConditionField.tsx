import type { Completion, CompletionSection } from "@codemirror/autocomplete";
import { snippetCompletion } from "@codemirror/autocomplete";
import { useCallback, useMemo } from "react";

import {
  type DSLFilterCompletionRequest,
  type DSLFilterComprehensionCall,
  DSLFilterConditionField,
  type DSLFilterSnippet,
  detectDSLFilterComprehensionCall,
  detectDSLFilterComprehensionScope,
  detectDSLFilterForClauseTarget,
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
 * Collections rank ahead of Attributes and Annotations: they are core language
 * surface, while the latter two grow with data-derived names and are the right
 * sections to lose to the browse-view cap.
 */
const vocabularyCategorySections: Record<string, CompletionSection> = {
  session: { name: "Session", rank: 4 },
  aggregate: { name: "Aggregates", rank: 5 },
  iterable: { name: "Collections", rank: 6 },
  attribute: { name: "Attributes", rank: 7 },
  annotation: { name: "Annotations", rank: 8 },
};

/**
 * Element fields replace the whole dropdown inside a comprehension, so they
 * need only one group of their own.
 */
const elementFieldsSection: CompletionSection = { name: "Fields", rank: 1 };

/**
 * The loop variable each collection's inserted comprehensions (and served
 * descriptions) use — `any(span… for span in spans)`, `any(trace… for trace
 * in traces)`. Whole words, not letters. A collection the map doesn't know
 * falls back to its singular.
 */
const canonicalLoopVariables: Record<string, string> = {
  spans: "span",
  traces: "trace",
  session_annotations: "annotation",
  span_annotations: "annotation",
  span_cost_details: "cost_detail",
};

function getLoopVariable(iterableName: string): string {
  return (
    canonicalLoopVariables[iterableName] ??
    (iterableName.endsWith("s") ? iterableName.slice(0, -1) : "item")
  );
}

/**
 * The example predicate a collection's inserted comprehension starts with, as
 * a selected tab-through placeholder. It must be *valid* — an inserted
 * condition that errors until a blank is filled reads as broken, not as an
 * invitation to edit — and each references its collection's loop variable
 * from `canonicalLoopVariables`. A collection the map doesn't know falls back
 * to a bare `condition` placeholder.
 */
const examplePredicates: Record<string, string> = {
  spans: "span.latency_ms > 1_000",
  traces: "trace.latency_ms > 10_000",
  session_annotations: "annotation.score < 0.5",
  span_annotations: "annotation.score < 0.5",
  span_cost_details: "cost_detail.tokens > 1_000",
};

function getExamplePredicate(iterableName: string): string {
  return examplePredicates[iterableName] ?? "condition";
}

/**
 * Example conditions for the typeahead's "Suggestions" group.
 * `${placeholder}` segments become tab-through fields on insert; subscripted
 * names use double quotes to match the served vocabulary.
 *
 * Every snippet is valid as inserted — placeholders carry working example
 * values, never blanks — and each teaches something no other snippet (or
 * plain aggregate) already covers. The first `MAX_BROWSE_SUGGESTIONS` are
 * what a browsing user sees: one construct each — text search, aggregate,
 * quantifier, reduction, nested comprehension. Text search leads on a
 * `boost`, since it is the query the retired search field used to serve and
 * the one a user arriving at an empty filter most often wants; the rest sort
 * alphabetically among themselves. The remainder of the array runs the
 * one-line field filters before the parameterized comprehension templates.
 */
export const sessionFilterSnippets: DSLFilterSnippet[] = [
  {
    label: "search inputs and outputs for text",
    snippet: "'${search text}' in any_input or '${search text}' in any_output",
    boost: 1,
  },
  {
    label: "filter by number of traces",
    snippet: "num_traces >= ${5}",
  },
  {
    label: "any span errored",
    snippet: 'any(span.status_code == "ERROR" for span in spans)',
  },
  {
    label: "slowest span in the session",
    snippet: "max(span.latency_ms for span in spans) > ${5_000}",
  },
  {
    label: "any trace used a tool",
    snippet:
      'any(any(span.span_kind == "TOOL" for span in trace.spans) for trace in traces)',
  },
  {
    label: "combine session and span conditions",
    snippet:
      'num_traces >= ${5} and any(span.status_code == "ERROR" for span in spans)',
  },
  {
    label: "filter by errors",
    snippet: "num_traces_with_error > 0",
  },
  {
    label: "filter by duration",
    snippet: "duration_ms >= ${10_000}",
  },
  {
    label: "filter by session id",
    snippet: "session_id == '${session id}'",
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
    label: "filter by tool usage",
    snippet: "tool_span_count > 0",
  },
  {
    label: "filter by user",
    snippet: "user.id == '${user id}'",
  },
  {
    label: "filter by metadata",
    snippet: "metadata[\"${key}\"] == '${value}'",
  },
  {
    label: "filter by annotation score",
    snippet: 'annotations["${name}"].score >= ${0.5}',
  },
  {
    label: "filter by annotation label",
    snippet: "annotations[\"${name}\"].label == '${label}'",
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
    label: "any span matches a condition",
    snippet: "any(${span.latency_ms > 1000} for span in ${spans})",
  },
  {
    // `all` over an empty collection is vacuously true, so the template
    // carries the non-empty guard rather than teaching a query that matches
    // every session with no spans at all.
    label: "all spans match a condition",
    snippet:
      "len([span for span in ${spans}]) > 0 and all(${span.latency_ms < 1000} for span in ${spans})",
  },
  {
    label: "count spans matching a condition",
    snippet:
      'len([span for span in spans if span.span_kind == "${TOOL}"]) >= ${2}',
  },
  {
    label: "any trace matches a condition",
    snippet: "any(${trace.latency_ms > 10_000} for trace in ${traces})",
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
 * A collection completed at the top level of a condition: the bare name would
 * never validate (collections are looped over, not compared), so accepting it
 * inserts a whole `any(… for s in spans)` comprehension with a valid example
 * predicate selected as a tab-through placeholder — overtyping it hands off
 * to element-field completion. The `detail` previews that shape, which is
 * also what tells a browsing user what a collection *is* for.
 */
function getIterableScaffoldCompletion(
  term: SessionFilterVocabularyTerm
): Completion {
  const loopVariable = getLoopVariable(term.name);
  const predicate = getExamplePredicate(term.name);
  return snippetCompletion(
    `any(\${${predicate}} for ${loopVariable} in ${term.name})`,
    {
      label: term.name,
      type: "variable",
      detail: `any(… for ${loopVariable} in ${term.name})`,
      info: term.description,
      section: vocabularyCategorySections[term.category],
    }
  );
}

/**
 * A collection completed inside a hand-typed `any(`/`sum(`/… call that has no
 * `for` clause yet: accepting inserts the comprehension body. `len` takes a
 * list comprehension rather than a generator, so its body is bracketed unless
 * the user already opened `len([` themselves.
 */
function getIterableBodyCompletion(
  term: SessionFilterVocabularyTerm,
  call: DSLFilterComprehensionCall
): Completion {
  const loopVariable = getLoopVariable(term.name);
  const predicate = getExamplePredicate(term.name);
  const body = `\${${predicate}} for ${loopVariable} in ${term.name}`;
  const needsListBrackets = call.functionName === "len" && !call.isListForm;
  return snippetCompletion(needsListBrackets ? `[${body}]` : body, {
    label: term.name,
    type: "variable",
    detail: `… for ${loopVariable} in ${term.name}`,
    info: term.description,
    section: vocabularyCategorySections[term.category],
  });
}

/**
 * A collection completed in the iterable slot of a `for` clause the user is
 * writing themselves: the one position where the bare name is exactly right.
 */
function getIterableNameCompletion(
  term: SessionFilterVocabularyTerm
): Completion {
  return {
    label: term.name,
    type: "variable",
    detail: "collection",
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
    placeholder = "filter condition (e.g. num_traces >= 5)",
  } = props;
  const { filterCondition, setFilterCondition } = useSessionFilters();
  const projectId = useTracingContext((state) => state.projectId);

  // Element fields are split out of the top-level vocabulary: offering
  // `latency_ms` bare would complete a condition the compiler rejects, since
  // it only binds inside a comprehension over the collection that exposes it.
  const { completions, elementTermsByIterable, iterableTerms, iterableNames } =
    useMemo(() => {
      const topLevelCompletions: Completion[] = [];
      const elementTerms = new Map<string, SessionFilterVocabularyTerm[]>();
      const collectionTerms: SessionFilterVocabularyTerm[] = [];

      for (const term of vocabulary) {
        if (term.iterableName) {
          const terms = elementTerms.get(term.iterableName) ?? [];
          terms.push(term);
          elementTerms.set(term.iterableName, terms);
        } else if (term.category === "iterable") {
          collectionTerms.push(term);
          topLevelCompletions.push(getIterableScaffoldCompletion(term));
        } else {
          topLevelCompletions.push(getCompletionOption(term));
        }
      }

      return {
        // Section-rank order: the field caps the browse view, so the core
        // vocabulary has to come before observed names
        completions: topLevelCompletions.sort(compareBySectionRank),
        elementTermsByIterable: elementTerms,
        iterableTerms: collectionTerms,
        iterableNames: new Set(collectionTerms.map((term) => term.name)),
      };
    }, [vocabulary]);

  // Comprehension positions replace the dropdown rather than joining it, most
  // to least specific: the iterable slot of a `for` clause takes collection
  // names, a classified comprehension body takes the loop variable's fields,
  // and a hand-typed `any(`/`sum(` with no `for` clause yet takes whole
  // comprehension bodies. An unclassifiable cursor returns null and completion
  // behaves as it always has.
  const getContextualCompletions = useCallback(
    ({ textBeforeCursor, textAfterCursor }: DSLFilterCompletionRequest) => {
      if (detectDSLFilterForClauseTarget({ textBeforeCursor })) {
        return iterableTerms.map(getIterableNameCompletion);
      }
      const scope = detectDSLFilterComprehensionScope({
        textBeforeCursor,
        textAfterCursor,
        isIterableName: (name) => iterableNames.has(name),
      });
      if (scope) {
        const terms = elementTermsByIterable.get(scope.iterableName);
        return terms
          ? terms.map((term) =>
              getElementCompletionOption(term, scope.loopVariable)
            )
          : null;
      }
      const call = detectDSLFilterComprehensionCall({ textBeforeCursor });
      if (call) {
        return iterableTerms.map((term) =>
          getIterableBodyCompletion(term, call)
        );
      }
      return null;
    },
    [iterableTerms, iterableNames, elementTermsByIterable]
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
    ({
      condition,
      isInitialSettlement,
    }: {
      condition: string;
      isInitialSettlement: boolean;
    }) => {
      if (!isInitialSettlement) {
        // A mount value arrives from the URL or a caller's default; recording
        // it would turn "no filter chosen" into a history entry.
        recordValidCondition(condition);
      }
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
