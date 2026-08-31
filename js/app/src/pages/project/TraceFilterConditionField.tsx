import type { Completion, CompletionSection } from "@codemirror/autocomplete";
import { snippetCompletion } from "@codemirror/autocomplete";
import { useCallback, useMemo } from "react";

import {
  AIQueryDSLFilterField,
  type DSLFilterAIQueryProps,
  type DSLFilterCompletionRequest,
  type DSLFilterComprehensionCall,
  detectDSLFilterComprehensionCall,
  detectDSLFilterComprehensionScope,
  detectDSLFilterEnclosingComprehensionScopeForClauseTarget,
  detectDSLFilterForClauseTarget,
  findDSLFilterComprehensionRange,
  useDSLFilterConditionHistory,
} from "@phoenix/components/filter";
import { useTracingContext } from "@phoenix/contexts/TracingContext";

import {
  createTraceFilterAIQueryDSL,
  getTraceFilterLoopVariable,
  traceFilterSnippets,
  type TraceFilterVocabularyTerm,
} from "./traceFilterDSL";
import { useTraceFilters } from "./TraceFiltersContext";
import { validateTraceFilterCondition } from "./traceFilterValidation";

/** Ranks continue after `DSLFilterConditionField`'s built-in sections (0–3). */
const vocabularyCategorySections: Record<string, CompletionSection> = {
  trace: { name: "Trace", rank: 4 },
  aggregate: { name: "Aggregates", rank: 5 },
  iterable: { name: "Collections", rank: 6 },
  attribute: { name: "Attributes", rank: 7 },
  annotation: { name: "Annotations", rank: 8 },
};

const elementFieldsSection: CompletionSection = { name: "Fields", rank: 1 };

/** Tab-through placeholders for inserted comprehensions; each must be a valid predicate over its collection's loop variable. */
const examplePredicates: Partial<Record<string, string>> = {
  spans: "span.latency_ms > 1_000",
  trace_annotations: "annotation.score < 0.5",
  span_annotations: "annotation.score < 0.5",
  span_cost_details: "cost_detail.tokens > 1_000",
};

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

/** Bare collection names never validate, so accepting one inserts a full comprehension with an editable example predicate. */
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

/** Inserts a comprehension body into a hand-typed call; `len` takes a list comprehension, so its body is bracketed unless the user already opened `len([`. */
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
  // An empty vocabulary means the project's terms haven't arrived (the field
  // renders ahead of them, see the Suspense fallback in TracesTable), so AI
  // query waits rather than prompting the model with no field names.
  const traceFilterAIQuery = useMemo<DSLFilterAIQueryProps>(
    () => ({
      dsl: createTraceFilterAIQueryDSL(vocabulary),
      isDisabled: vocabulary.length === 0,
    }),
    [vocabulary]
  );

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
    <AIQueryDSLFilterField
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
      aiQuery={traceFilterAIQuery}
    />
  );
}
