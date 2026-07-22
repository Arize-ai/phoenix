import { useCallback } from "react";

import {
  getCategoryChartColor,
  useCategoryChartColors,
} from "@phoenix/components/chart";

/**
 * A hook that maps categorical colors to experiment indexes
 */
export function useExperimentColors() {
  const colors = useCategoryChartColors();

  const getExperimentColor = useCallback(
    (experimentIndex: number) =>
      getCategoryChartColor({ index: experimentIndex, colors }),
    [colors]
  );

  return {
    getExperimentColor,
    baseExperimentColor: "var(--global-color-gray-500)",
  };
}
