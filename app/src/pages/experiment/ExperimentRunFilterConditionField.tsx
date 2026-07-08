import type { Completion } from "@codemirror/autocomplete";
import { useMemo } from "react";
import { useSearchParams } from "react-router";
import { fetchQuery, graphql } from "relay-runtime";

import {
  createAnnotationMemberCompletions,
  DSLFilterConditionField,
  type DSLFilterSnippet,
} from "@phoenix/components/filter";
import environment from "@phoenix/RelayEnvironment";

import type { ExperimentRunFilterConditionFieldCompletionsQuery } from "./__generated__/ExperimentRunFilterConditionFieldCompletionsQuery.graphql";
import type { ExperimentRunFilterConditionFieldValidationQuery } from "./__generated__/ExperimentRunFilterConditionFieldValidationQuery.graphql";
import { useExperimentRunFilterCondition } from "./ExperimentRunFilterConditionContext";

/**
 * The fields of the experiment run filter DSL that an expression can
 * reference
 */
const experimentRunFilterCompletions: Completion[] = [
  {
    label: "input",
    type: "variable",
    info: "The input of the dataset example",
  },
  {
    label: "reference_output",
    type: "variable",
    info: "The reference output of the dataset example",
  },
  {
    label: "metadata",
    type: "variable",
    info: "The metadata of the dataset example",
  },
  {
    label: "output",
    type: "variable",
    info: "The output of the experiment run",
  },
  {
    label: "error",
    type: "variable",
    info: "The error message of the experiment run (if exists)",
  },
  {
    label: "latency_ms",
    type: "variable",
    info: "The duration of the experiment run in milliseconds",
  },
  {
    label: "evals",
    type: "variable",
    info: "The evaluations of the experiment run, accessed by name",
  },
  {
    label: "experiments",
    type: "variable",
    info: "The experiments being compared, accessed by position - e.x. experiments[0]",
  },
];

/**
 * Example conditions shown as suggestions in the typeahead — notably when
 * the empty field is focused. `${placeholder}` segments become tab-through
 * fields on insert.
 */
const experimentRunFilterSnippets: DSLFilterSnippet[] = [
  {
    label: "search output for substring",
    snippet: "'${search text}' in output",
  },
  {
    label: "search input for substring",
    snippet: "'${search text}' in input",
  },
  {
    label: "search reference output for substring",
    snippet: "'${search text}' in reference_output",
  },
  {
    label: "filter on errors",
    snippet: "error is not None",
  },
  {
    label: "filter out errors",
    snippet: "error is None",
  },
  {
    label: "filter by evaluation label",
    snippet: "evals['${name}'].label == '${label}'",
  },
  {
    label: "filter by evaluation score",
    snippet: "evals['${name}'].score >= ${0.5}",
  },
  {
    label: "search evaluation explanation",
    snippet: "'${search text}' in evals['${name}'].explanation",
  },
  {
    label: "filter for lower scores than first experiment",
    snippet: "evals['${name}'].score < experiments[0].evals['${name}'].score",
  },
  {
    label: "filter by metadata",
    snippet: "metadata['${key}'] == '${value}'",
  },
  {
    label: "filter by latency",
    snippet: "latency_ms >= ${10_000}",
  },
];

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

type ExperimentRunFilterConditionFieldProps = {
  /**
   * Callback when the condition is valid
   */
  onValidCondition: (condition: string) => void;
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
    <DSLFilterConditionField
      aria-label="Filter experiment runs"
      value={filterCondition}
      onChange={setFilterCondition}
      placeholder={placeholder}
      completions={experimentRunFilterCompletions}
      snippets={experimentRunFilterSnippets}
      loadCompletions={loadEvaluationCompletions}
      validateCondition={validateCondition}
      onValidCondition={onValidCondition}
    />
  );
}
