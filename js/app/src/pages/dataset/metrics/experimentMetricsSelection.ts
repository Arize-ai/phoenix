import { useCallback } from "react";

import { useExperimentColors } from "@phoenix/components/experiment";
import { EXPERIMENT_METRICS_EXPERIMENT_COUNT } from "@phoenix/pages/dataset/constants";

import {
  type ExperimentReferenceLabel,
  getExperimentReferenceLabel,
} from "./ExperimentBaselineReference";
import type { ExperimentMetricsSelection } from "./types";

/**
 * The experiment IDs of a selection, base experiment first.
 */
export function getSelectionExperimentIds(
  selection: ExperimentMetricsSelection
): string[] {
  return [selection.baseExperimentId, ...selection.compareExperimentIds];
}

/**
 * Builds the query variables for the dataset's most recent experiments, or for
 * exactly the selected experiments when a selection is given.
 */
export function getExperimentMetricsQueryVariables({
  datasetId,
  selection,
}: {
  datasetId: string;
  selection?: ExperimentMetricsSelection;
}) {
  if (selection == null) {
    return {
      id: datasetId,
      count: EXPERIMENT_METRICS_EXPERIMENT_COUNT,
      filterIds: null,
      isSelection: false,
    };
  }
  const filterIds = getSelectionExperimentIds(selection);
  return {
    id: datasetId,
    count: filterIds.length,
    filterIds,
    isSelection: true,
  };
}

/**
 * Orders experiments by their position in the selection, base experiment
 * first. Experiments that are not part of the selection, or selected
 * experiments missing from the list, are left out.
 */
export function orderBySelection<T extends { id: string }>({
  experiments,
  selection,
}: {
  experiments: readonly T[];
  selection: ExperimentMetricsSelection;
}): T[] {
  const experimentsById = new Map(
    experiments.map((experiment) => [experiment.id, experiment])
  );
  return getSelectionExperimentIds(selection).flatMap((experimentId) => {
    const experiment = experimentsById.get(experimentId);
    return experiment == null ? [] : [experiment];
  });
}

/**
 * Returns a lookup of each selected experiment's compare page color. Outside a
 * selection there are no experiment colors and the lookup returns undefined.
 */
export function useSelectionExperimentColor(
  selection: ExperimentMetricsSelection | undefined
): (experimentId: string) => string | undefined {
  const { baseExperimentColor, getExperimentColor } = useExperimentColors();
  return useCallback(
    (experimentId: string) => {
      if (selection == null) {
        return undefined;
      }
      if (experimentId === selection.baseExperimentId) {
        return baseExperimentColor;
      }
      const compareIndex = selection.compareExperimentIds.indexOf(experimentId);
      return compareIndex === -1 ? undefined : getExperimentColor(compareIndex);
    },
    [baseExperimentColor, getExperimentColor, selection]
  );
}

/**
 * The experiment fields every experiment metric chart datum carries: its x
 * axis key and what its tooltip header shows.
 */
export type ExperimentChartDatum = {
  sequenceNumber: number;
  experimentName: string;
  isBaseline: boolean;
  experimentColor: string | undefined;
  referenceLabel: ExperimentReferenceLabel;
};

/**
 * What a metric chart needs to plot experiments from either the dataset's
 * most recent experiments or a selection: the reference experiment's label
 * and a builder for each experiment's shared datum fields.
 */
export function useExperimentChartDatum(
  selection: ExperimentMetricsSelection | undefined
) {
  const referenceLabel = getExperimentReferenceLabel(selection);
  const getExperimentColor = useSelectionExperimentColor(selection);
  const toExperimentChartDatum = useCallback(
    (experiment: {
      id: string;
      name: string;
      sequenceNumber: number;
      isBaseline: boolean;
    }): ExperimentChartDatum => ({
      sequenceNumber: experiment.sequenceNumber,
      experimentName: experiment.name,
      isBaseline: experiment.isBaseline,
      experimentColor: getExperimentColor(experiment.id),
      referenceLabel,
    }),
    [getExperimentColor, referenceLabel]
  );
  return { referenceLabel, toExperimentChartDatum };
}
