import type { Completion } from "@codemirror/autocomplete";
import { useSearchParams } from "react-router";
import { fetchQuery, graphql } from "relay-runtime";

import {
  DSLFilterConditionBuilder,
  DSLFilterConditionField,
  type DSLFilterSnippet,
} from "@phoenix/components/filter";
import environment from "@phoenix/RelayEnvironment";

import type { ExperimentRunFilterConditionFieldValidationQuery } from "./__generated__/ExperimentRunFilterConditionFieldValidationQuery.graphql";
import { useExperimentRunFilterCondition } from "./ExperimentRunFilterConditionContext";

/**
 * The vocabulary of the experiment run filter DSL: fields on an experiment
 * run plus macro snippets for common conditions.
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
    info: "The evaluations of the experiment run",
  },
  {
    label: "search input",
    type: "text",
    apply: "'' in input",
    detail: "macro",
  },
  {
    label: "search reference output",
    type: "text",
    apply: "'' in reference_output",
    detail: "macro",
  },
  {
    label: "search output",
    type: "text",
    apply: "'' in output",
    detail: "macro",
  },
  {
    label: "has error",
    type: "text",
    apply: "error is not None",
    detail: "macro",
  },
  {
    label: "Latency >= 10s",
    type: "text",
    apply: "latency_ms >= 10_000",
    detail: "macro",
  },
  {
    label: "Hallucinations",
    type: "text",
    apply: "evals['hallucination'].label == 'hallucinated'",
    detail: "macro",
  },
  {
    label: "Metadata",
    type: "text",
    apply: "metadata['category'] == 'hard_examples'",
    detail: "macro",
  },
];

const experimentRunFilterSnippets: DSLFilterSnippet[] = [
  {
    key: "substring",
    label: "filter by substring",
    snippet: "'search term' in output['key']",
  },
  {
    key: "errors",
    label: "filter on errors",
    snippet: "error is not None",
  },
  {
    key: "eval_label",
    label: "filter by evaluation label",
    snippet: "evals['hallucination'].label == 'hallucinated'",
  },
  {
    key: "eval_score",
    label: "filter by evaluation score",
    snippet: "evals['hallucination'].score >= 0.5",
  },
  {
    key: "eval_explanation",
    label: "filter by evaluation explanation",
    snippet: "'search term' in evals['hallucination'].explanation",
  },
  {
    key: "compare_experiments",
    label: "filter for lower scores than first experiment",
    snippet:
      "evals['hallucination'].score < experiments[0].evals['hallucination'].score",
  },
  {
    key: "metadata",
    label: "filter by metadata",
    snippet: "metadata['category'] == 'hard_examples'",
  },
  {
    key: "latency",
    label: "filter by latency",
    snippet: "latency_ms >= 10_000",
  },
];

/**
 * Async server-side validation of the experiment run filter condition expression
 */
async function validateExperimentRunFilterCondition(
  condition: string,
  experimentIds: string[]
) {
  if (!condition) {
    return {
      isValid: true,
      errorMessage: null,
    };
  }
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
  const { filterCondition, setFilterCondition, appendFilterCondition } =
    useExperimentRunFilterCondition();

  const [searchParams] = useSearchParams();
  const experimentIds = searchParams.getAll("experimentId");

  return (
    <DSLFilterConditionField
      value={filterCondition}
      onChange={setFilterCondition}
      placeholder={placeholder}
      completions={experimentRunFilterCompletions}
      validateCondition={(condition) =>
        validateExperimentRunFilterCondition(condition, experimentIds)
      }
      onValidCondition={onValidCondition}
      builder={
        <DSLFilterConditionBuilder
          snippets={experimentRunFilterSnippets}
          onAddCondition={appendFilterCondition}
        />
      }
    />
  );
}
