import type { Completion } from "@codemirror/autocomplete";
import { useMemo } from "react";
import { useSearchParams } from "react-router";
import { fetchQuery, graphql } from "relay-runtime";

import {
  AIQueryDSLFilterField,
  createAnnotationMemberCompletions,
  type DSLFilterAIQueryProps,
} from "@phoenix/components/filter";
import environment from "@phoenix/RelayEnvironment";

import type { ExperimentRunFilterConditionFieldCompletionsQuery } from "./__generated__/ExperimentRunFilterConditionFieldCompletionsQuery.graphql";
import type { ExperimentRunFilterConditionFieldValidationQuery } from "./__generated__/ExperimentRunFilterConditionFieldValidationQuery.graphql";
import { useExperimentRunFilterCondition } from "./ExperimentRunFilterConditionContext";
import {
  experimentRunFilterAIQueryDSL,
  experimentRunFilterCompletions,
  experimentRunFilterSnippets,
} from "./experimentRunFilterDSL";

/**
 * Opts the field into AI query with the DSL description derived in
 * `experimentRunFilterDSL.ts` from the same vocabulary the typeahead uses.
 */
const experimentRunFilterAIQuery: DSLFilterAIQueryProps = {
  dsl: experimentRunFilterAIQueryDSL,
};

/**
 * Fetches the evaluation names that actually exist on the experiments so the
 * typeahead can suggest real values rather than made-up examples
 */
async function fetchEvaluationCompletions(
  experimentIds: string[]
): Promise<Completion[]> {
  const results = await Promise.all(
    experimentIds.map((id) =>
      fetchQuery<ExperimentRunFilterConditionFieldCompletionsQuery>(
        environment,
        graphql`
          query ExperimentRunFilterConditionFieldCompletionsQuery($id: ID!) {
            experiment: node(id: $id) {
              ... on Experiment {
                annotationSummaries {
                  annotationName
                }
              }
            }
          }
        `,
        { id }
      ).toPromise()
    )
  );
  const names = new Set<string>();
  for (const result of results) {
    for (const summary of result?.experiment?.annotationSummaries ?? []) {
      names.add(summary.annotationName);
    }
  }
  return createAnnotationMemberCompletions({
    accessor: "evals",
    noun: "evaluation",
    sectionName: "Evaluations",
    names: [...names],
  });
}

/**
 * Async server-side validation of the experiment run filter condition expression
 */
async function validateExperimentRunFilterCondition(
  condition: string,
  experimentIds: string[]
) {
  const validationResult =
    await fetchQuery<ExperimentRunFilterConditionFieldValidationQuery>(
      environment,
      graphql`
        query ExperimentRunFilterConditionFieldValidationQuery(
          $condition: String!
          $experimentIds: [ID!]!
        ) {
          validateExperimentRunFilterCondition(
            condition: $condition
            experimentIds: $experimentIds
          ) {
            isValid
            errorMessage
          }
        }
      `,
      { condition, experimentIds }
    ).toPromise();
  // Satisfy the type checker
  if (!validationResult) {
    throw new Error("Filter condition validation is null");
  }
  return validationResult.validateExperimentRunFilterCondition;
}

/**
 * The argument handed to `onValidCondition`: the condition that passed
 * validation
 */
export type ExperimentRunFilterValidConditionArgs = {
  condition: string;
};

type ExperimentRunFilterConditionFieldProps = {
  /**
   * Callback when the condition is valid
   */
  onValidCondition: (args: ExperimentRunFilterValidConditionArgs) => void;
  placeholder?: string;
};
export function ExperimentRunFilterConditionField(
  props: ExperimentRunFilterConditionFieldProps
) {
  const {
    onValidCondition,
    placeholder = `filter condition (e.g., evals["Hallucination"].label == 'hallucinated')`,
  } = props;
  const { filterCondition, setFilterCondition } =
    useExperimentRunFilterCondition();

  const [searchParams] = useSearchParams();
  // Key the callbacks below on the ids' contents rather than the searchParams
  // object, whose identity changes when any unrelated param changes
  const experimentIdsKey = searchParams.getAll("experimentId").join(",");

  const { loadEvaluationCompletions, validateCondition } = useMemo(() => {
    const ids = experimentIdsKey.split(",").filter(Boolean);
    return {
      // Stable identity so the field fetches (and caches) the experiments'
      // real evaluation names only once
      loadEvaluationCompletions:
        ids.length > 0 ? () => fetchEvaluationCompletions(ids) : undefined,
      validateCondition: (condition: string) =>
        validateExperimentRunFilterCondition(condition, ids),
    };
  }, [experimentIdsKey]);

  return (
    <AIQueryDSLFilterField
      aria-label="Filter experiment runs"
      value={filterCondition}
      onChange={setFilterCondition}
      placeholder={placeholder}
      completions={experimentRunFilterCompletions}
      snippets={experimentRunFilterSnippets}
      loadCompletions={loadEvaluationCompletions}
      validateCondition={validateCondition}
      onValidCondition={onValidCondition}
      aiQuery={experimentRunFilterAIQuery}
    />
  );
}
