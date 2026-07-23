import { useCallback } from "react";
import { graphql, useMutation } from "react-relay";

import { useNotifySuccess } from "@phoenix/contexts";
import { useDatasetContext } from "@phoenix/contexts/DatasetContext";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import type { useSetExperimentBaselineMutation } from "./__generated__/useSetExperimentBaselineMutation.graphql";

type SetExperimentBaselineParams = {
  experimentId: string;
  isBaseline: boolean;
  onCompleted?: () => void;
  onError?: (message: string) => void;
};

export function useSetExperimentBaseline() {
  const notifySuccess = useNotifySuccess();
  const refreshExperimentAnnotationMetrics = useDatasetContext(
    (state) => state.refreshExperimentAnnotationMetrics
  );
  const [commitSetExperimentBaseline, isSettingExperimentBaseline] =
    useMutation<useSetExperimentBaselineMutation>(graphql`
      mutation useSetExperimentBaselineMutation(
        $experimentId: ID!
        $baseline: Boolean!
      ) {
        setExperimentBaseline(
          experimentId: $experimentId
          baseline: $baseline
        ) {
          dataset {
            id
            baselineExperiment {
              ...useExperimentMetricsData_experiment
            }
          }
          experiment {
            id
            isBaseline
          }
          previousBaselineExperiment {
            id
            isBaseline
          }
        }
      }
    `);

  const setExperimentBaseline = useCallback(
    ({
      experimentId,
      isBaseline,
      onCompleted,
      onError,
    }: SetExperimentBaselineParams) => {
      const nextBaseline = !isBaseline;
      commitSetExperimentBaseline({
        variables: {
          experimentId,
          baseline: nextBaseline,
        },
        onCompleted: () => {
          // The mutation updates the baseline link, but filtered annotation
          // summaries for an out-of-window experiment still need to be fetched.
          refreshExperimentAnnotationMetrics();
          notifySuccess({
            title: nextBaseline ? "Baseline set" : "Baseline removed",
            message: nextBaseline
              ? "The experiment has been marked as the baseline."
              : "The experiment is no longer marked as the baseline.",
          });
          onCompleted?.();
        },
        onError: (error) => {
          const formattedError = getErrorMessagesFromRelayMutationError(error);
          onError?.(formattedError?.[0] ?? error.message);
        },
      });
    },
    [
      commitSetExperimentBaseline,
      notifySuccess,
      refreshExperimentAnnotationMetrics,
    ]
  );

  return {
    setExperimentBaseline,
    isSettingExperimentBaseline,
  };
}
