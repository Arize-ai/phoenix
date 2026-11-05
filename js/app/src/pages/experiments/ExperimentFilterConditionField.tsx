import { useCallback, useMemo } from "react";

import {
  DSLFilterConditionField,
  type DSLFilterValidConditionArgs,
  useDSLFilterConditionHistory,
} from "@phoenix/components/filter";

import {
  experimentFilterCompletions,
  experimentFilterSnippets,
} from "./experimentFilterDSL";
import { validateExperimentFilterCondition } from "./experimentFilterValidation";

export type ExperimentFilterValidConditionArgs = Pick<
  DSLFilterValidConditionArgs,
  "condition" | "isInitialSettlement"
>;

/**
 * A filter expression field for a dataset's experiments, such as
 * `metadata["model"] == "gpt-5" and repetitions > 1`.
 */
export function ExperimentFilterConditionField({
  datasetId,
  value,
  onChange,
  onValidCondition,
}: {
  datasetId: string;
  value: string;
  onChange: (condition: string) => void;
  onValidCondition: (args: ExperimentFilterValidConditionArgs) => void;
}) {
  // Stable identity: the field's validation effect keys on `validateCondition`
  const validateCondition = useCallback(
    (condition: string) =>
      validateExperimentFilterCondition(condition, datasetId),
    [datasetId]
  );

  const {
    completionSource: recentSearchesCompletionSource,
    recordValidCondition,
  } = useDSLFilterConditionHistory({
    historyKey: `experiment-filter-${datasetId}`,
  });

  const completionSources = useMemo(
    () => [recentSearchesCompletionSource],
    [recentSearchesCompletionSource]
  );

  const handleValidCondition = useCallback(
    ({
      condition,
      isInitialSettlement,
    }: ExperimentFilterValidConditionArgs) => {
      if (!isInitialSettlement) {
        // A mount value arrives from the URL; recording it would turn "no
        // filter chosen" into a history entry.
        recordValidCondition(condition);
      }
      onValidCondition({ condition, isInitialSettlement });
    },
    [recordValidCondition, onValidCondition]
  );

  return (
    <DSLFilterConditionField
      aria-label="Filter experiments"
      value={value}
      onChange={onChange}
      placeholder='filter condition (e.g. metadata["model"] == "gpt-5")'
      completions={experimentFilterCompletions}
      snippets={experimentFilterSnippets}
      completionSources={completionSources}
      validateCondition={validateCondition}
      onValidCondition={handleValidCondition}
    />
  );
}
