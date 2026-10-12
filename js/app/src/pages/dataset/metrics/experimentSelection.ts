import { useCallback } from "react";

import { useExperimentColors } from "@phoenix/components/experiment";
import { EXPERIMENT_METRICS_EXPERIMENT_COUNT } from "@phoenix/pages/dataset/constants";

import {
  type ExperimentReferenceLabel,
  getExperimentReferenceLabel,
} from "./ExperimentBaselineReference";
import type { ComparedExperimentSelection, ExperimentSelection } from "./types";

/**
 * The IDs of the compared experiments, base experiment first.
 */
export function getComparedExperimentIds(
  experimentSelection: ComparedExperimentSelection
): string[] {
  return [
    experimentSelection.baseExperimentId,
    ...experimentSelection.compareExperimentIds,
  ];
}

/**
 * Builds the query variables that load the selected experiments: the
 * dataset's most recent experiments, or exactly the compared experiments.
 */
export function getExperimentMetricsQueryVariables({
  datasetId,
  experimentSelection,
}: {
  datasetId: string;
  experimentSelection: ExperimentSelection;
}) {
  if (experimentSelection.type === "recent") {
    return {
      id: datasetId,
      count: EXPERIMENT_METRICS_EXPERIMENT_COUNT,
      filterIds: null,
      isComparedSelection: false,
    };
  }
  const filterIds = getComparedExperimentIds(experimentSelection);
  return {
    id: datasetId,
    count: filterIds.length,
    filterIds,
    isComparedSelection: true,
  };
}

/**
 * Orders experiments by their position in the compared selection, base
 * experiment first. Experiments that were not picked for comparison, or picked
 * experiments missing from the list, are left out.
 */
export function orderByComparedSelection<T extends { id: string }>({
  experiments,
  experimentSelection,
}: {
  experiments: readonly T[];
  experimentSelection: ComparedExperimentSelection;
}): T[] {
  const experimentsById = new Map(
    experiments.map((experiment) => [experiment.id, experiment])
  );
  return getComparedExperimentIds(experimentSelection).flatMap(
    (experimentId) => {
      const experiment = experimentsById.get(experimentId);
      return experiment == null ? [] : [experiment];
    }
  );
}

/**
 * Returns a lookup of each compared experiment's compare page color. The
 * dataset's recent experiments have no experiment colors, so for them the
 * lookup returns undefined.
 */
export function useExperimentSelectionColor(
  experimentSelection: ExperimentSelection
): (experimentId: string) => string | undefined {
  const { baseExperimentColor, getExperimentColor } = useExperimentColors();
  return useCallback(
    (experimentId: string) => {
      if (experimentSelection.type === "recent") {
        return undefined;
      }
      if (experimentId === experimentSelection.baseExperimentId) {
        return baseExperimentColor;
      }
      const compareIndex =
        experimentSelection.compareExperimentIds.indexOf(experimentId);
      return compareIndex === -1 ? undefined : getExperimentColor(compareIndex);
    },
    [baseExperimentColor, getExperimentColor, experimentSelection]
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
 * What a metric chart needs to plot the selected experiments: the reference
 * experiment's label and a builder for each experiment's shared datum fields.
 */
export function useExperimentChartDatum(
  experimentSelection: ExperimentSelection
) {
  const referenceLabel = getExperimentReferenceLabel(experimentSelection);
  const getExperimentColor = useExperimentSelectionColor(experimentSelection);
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
