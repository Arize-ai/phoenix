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
  detectDSLFilterEnclosingComprehensionScopeForClauseTarget,
  detectDSLFilterForClauseTarget,
  findDSLFilterComprehensionRange,
  useDSLFilterConditionHistory,
} from "@phoenix/components/filter";
import { useTracingContext } from "@phoenix/contexts/TracingContext";

import { useTraceFilters } from "./TraceFiltersContext";
import { validateTraceFilterCondition } from "./traceFilterValidation";

export type TraceFilterVocabularyTerm = {
  readonly name: string;
  readonly type: string;
  readonly description: string;
  readonly category: string;
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
  trace: { name: "Trace", rank: 4 },
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
 * The example predicate a collection's inserted comprehension starts with, as
 * a selected tab-through placeholder. It must be *valid* — an inserted
 * condition that errors until a blank is filled reads as broken, not as an
 * invitation to edit — and each references its collection's loop variable
 * from `getTraceFilterLoopVariable`. A collection the map doesn't know
 * falls back to a bare `condition` placeholder.
 */
const examplePredicates: Partial<Record<string, string>> = {
  spans: "span.latency_ms > 1_000",
  trace_annotations: "annotation.score < 0.5",
  span_annotations: "annotation.score < 0.5",
  span_cost_details: "cost_detail.tokens > 1_000",
};

const traceFilterLoopVariables: Partial<Record<string, string>> = {
  spans: "span",
  trace_annotations: "annotation",
  span_annotations: "annotation",
  span_cost_details: "cost_detail",
};

function getTraceFilterLoopVariable(iterableName: string): string {
  return (
    traceFilterLoopVariables[iterableName] ??
    (iterableName.endsWith("s") ? iterableName.slice(0, -1) : "item")
  );
}

export const traceFilterSnippets: DSLFilterSnippet[] = [
  {
    label: "search input and output for text",
    snippet: "'${search text}' in input or '${search text}' in output",
    boost: 1,
  },
  {
    label: "filter by number of spans",
    snippet: "num_spans >= ${5}",
  },
  {
    label: "any span errored",
    snippet: 'any(span.status_code == "ERROR" for span in spans)',
  },
  {
    label: "slowest span in the trace",
    snippet: "max(span.latency_ms for span in spans) > ${5_000}",
  },
  {
    label: "any span has an errored child",
    snippet:
      'any(any(child.status_code == "ERROR" for child in span.children) for span in spans)',
  },
  {
    label: "direct child of the trace root",
    snippet:
      "any(span.parent_span is not None and span.parent_span.parent_id is None for span in spans)",
  },
  {
    label: "combine trace and span conditions",
    snippet:
      'num_spans >= ${5} and any(span.status_code == "ERROR" for span in spans)',
  },
  {
    label: "filter by errors",
    snippet: "error_count > 0",
  },
  {
    label: "filter by duration",
    snippet: "latency_ms >= ${10_000}",
  },
  {
    label: "filter by trace id",
    snippet: "trace_id == '${trace id}'",
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
    snippet: 'trace_annotations["${name}"].score >= ${0.5}',
  },
  {
    label: "filter by annotation label",
    snippet: "trace_annotations[\"${name}\"].label == '${label}'",
  },
  {
    label: "search input for substring",
    snippet: "'${search text}' in input",
  },
  {
    label: "search output for substring",
    snippet: "'${search text}' in output",
  },
  {
    label: "any span matches a condition",
    snippet: "any(${span.latency_ms > 1000} for span in ${spans})",
  },
  {
    label: "all spans match a condition",
    snippet:
      "len([span for span in ${spans}]) > 0 and all(${span.latency_ms < 1000} for span in ${spans})",
  },
  {
    label: "count spans matching a condition",
    snippet:
      'len([span for span in spans if span.span_kind == "${TOOL}"]) >= ${2}',
  },
];

function getExamplePredicate(iterableName: string): string {
  return examplePredicates[iterableName] ?? "condition";
}

function getCompletionOption(term: TraceFilterVocabularyTerm): Completion {
  const completion: Completion = {
    label: term.name,
    type: "variable",
    // `detail` renders right-aligned in the dropdown; the category is
    // conveyed by the section header
    detail: term.type,
    info: term.description,
    section: vocabularyCategorySections[term.category],
  };
  return term.name === "attributes[...]"
    ? snippetCompletion('attributes["${key}"]', completion)
    : completion;
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
  term: TraceFilterVocabularyTerm
): Completion {
  const loopVariable = getTraceFilterLoopVariable(term.name);
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
  term: TraceFilterVocabularyTerm,
  call: DSLFilterComprehensionCall
): Completion {
  const loopVariable = getTraceFilterLoopVariable(term.name);
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
  term: TraceFilterVocabularyTerm
): Completion {
  return {
    label: term.name,
    type: "variable",
    detail: "collection",
    info: term.description,
    section: vocabularyCategorySections[term.category],
  };
}

/** A nested collection qualified by the enclosing comprehension variable. */
function getNestedIterableNameCompletion(
  term: TraceFilterVocabularyTerm,
  enclosingLoopVariable: string
): Completion {
  return {
    label: `${enclosingLoopVariable}.${term.name}`,
    type: "variable",
    detail: "collection",
    info: term.description,
    section: vocabularyCategorySections.iterable,
  };
}

/**
 * An element field is only ever written qualified by the comprehension's loop
 * variable, so it is offered that way — completing `s.latency_ms`, never a
 * bare `latency_ms` the compiler would reject.
 */
function getElementCompletionOption(
  term: TraceFilterVocabularyTerm,
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

type TraceFilterConditionFieldProps = {
  onValidCondition: (condition: string) => void;
  vocabulary: readonly TraceFilterVocabularyTerm[];
  placeholder?: string;
};

type TraceFilterCompletionModel = {
  completions: Completion[];
  elementTermsByIterable: Map<string, TraceFilterVocabularyTerm[]>;
  iterableTerms: TraceFilterVocabularyTerm[];
  iterableNames: Set<string>;
  nestedIterableTermsByIterable: Map<string, TraceFilterVocabularyTerm[]>;
};

export function buildTraceFilterCompletionModel(
  vocabulary: readonly TraceFilterVocabularyTerm[]
): TraceFilterCompletionModel {
  const topLevelCompletions: Completion[] = [];
  const elementTerms = new Map<string, TraceFilterVocabularyTerm[]>();
  const collectionTerms: TraceFilterVocabularyTerm[] = [];
  const collectionNames = new Set<string>();
  const nestedCollectionTerms = new Map<string, TraceFilterVocabularyTerm[]>();

  for (const term of vocabulary) {
    if (term.type === "iterable") {
      collectionNames.add(term.name);
      if (term.iterableName) {
        const terms = nestedCollectionTerms.get(term.iterableName) ?? [];
        terms.push(term);
        nestedCollectionTerms.set(term.iterableName, terms);
        continue;
      }
    }
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

  for (const [enclosingIterableName, nestedTerms] of nestedCollectionTerms) {
    const enclosingLoopVariable = getTraceFilterLoopVariable(
      enclosingIterableName
    );
    for (const term of nestedTerms) {
      const flattenedIterableName = `${enclosingLoopVariable}_${term.name}`;
      const sourceIterableName = collectionNames.has(flattenedIterableName)
        ? flattenedIterableName
        : enclosingIterableName;
      const sourceTerms = elementTerms.get(sourceIterableName);
      if (sourceTerms) {
        elementTerms.set(term.name, sourceTerms);
      }
    }
  }

  return {
    completions: topLevelCompletions.sort(compareBySectionRank),
    elementTermsByIterable: elementTerms,
    iterableTerms: collectionTerms,
    iterableNames: collectionNames,
    nestedIterableTermsByIterable: nestedCollectionTerms,
  };
}

export function getTraceFilterContextualCompletions({
  request,
  completionModel,
}: {
  request: DSLFilterCompletionRequest;
  completionModel: TraceFilterCompletionModel;
}): Completion[] | null {
  const {
    elementTermsByIterable,
    iterableTerms,
    iterableNames,
    nestedIterableTermsByIterable,
  } = completionModel;
  const { textBeforeCursor, textAfterCursor } = request;
  if (detectDSLFilterForClauseTarget({ textBeforeCursor })) {
    const enclosingScope =
      detectDSLFilterEnclosingComprehensionScopeForClauseTarget({
        textBeforeCursor,
        textAfterCursor,
        isIterableName: (name) => iterableNames.has(name),
      });
    const nestedTerms = enclosingScope
      ? nestedIterableTermsByIterable.get(enclosingScope.iterableName)
      : undefined;
    return nestedTerms && enclosingScope
      ? nestedTerms.map((term) =>
          getNestedIterableNameCompletion(term, enclosingScope.loopVariable)
        )
      : iterableTerms.map(getIterableNameCompletion);
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
    return iterableTerms.map((term) => getIterableBodyCompletion(term, call));
  }
  return null;
}

export function TraceFilterConditionField(
  props: TraceFilterConditionFieldProps
) {
  const {
    onValidCondition,
    vocabulary,
    placeholder = "filter condition (e.g. num_spans >= 5)",
  } = props;
  const { filterCondition, setFilterCondition } = useTraceFilters();
  const projectId = useTracingContext((state) => state.projectId);

  // Element fields are split out of the top-level vocabulary: offering
  // `latency_ms` bare would complete a condition the compiler rejects, since
  // it only binds inside a comprehension over the collection that exposes it.
  const completionModel = useMemo(
    () => buildTraceFilterCompletionModel(vocabulary),
    [vocabulary]
  );
  const { completions } = completionModel;

  // Comprehension positions replace the dropdown rather than joining it, most
  // to least specific: the iterable slot of a `for` clause takes collection
  // names, a classified comprehension body takes the loop variable's fields,
  // and a hand-typed `any(`/`sum(` with no `for` clause yet takes whole
  // comprehension bodies. An unclassifiable cursor returns null and completion
  // behaves as it always has.
  const getContextualCompletions = useCallback(
    (request: DSLFilterCompletionRequest) =>
      getTraceFilterContextualCompletions({ request, completionModel }),
    [completionModel]
  );

  // Stable identity: the field's validation effect keys on `validateCondition`
  const validateCondition = useCallback(
    (condition: string) => validateTraceFilterCondition(condition, projectId),
    [projectId]
  );

  const {
    completionSource: recentSearchesCompletionSource,
    recordValidCondition,
  } = useDSLFilterConditionHistory({
    historyKey: `trace-filter-${projectId}`,
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
      aria-label="Filter traces"
      className="trace-filter-condition-field"
      value={filterCondition}
      onChange={setFilterCondition}
      placeholder={placeholder}
      completions={completions}
      snippets={traceFilterSnippets}
      completionSources={completionSources}
      getContextualCompletions={getContextualCompletions}
      getErrorRange={findDSLFilterComprehensionRange}
      validateCondition={validateCondition}
      onValidCondition={handleValidCondition}
    />
  );
}
