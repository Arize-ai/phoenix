import { useCallback } from "react";

import { useCategoryChartColors } from "@phoenix/components/chart";

/**
 * A hook that maps categorical colors to experiment indexes
 */
export function useExperimentColors() {
  const colors = useCategoryChartColors();

  const getExperimentColor = useCallback(
    (experimentIndex: number) => {
      const colorValues = Object.values(colors);
      const numColors = colorValues.length;
      return colorValues[experimentIndex % numColors];
    },
    [colors]
  );

  return {
    getExperimentColor,
    baseExperimentColor: "var(--ac-global-color-grey-500)",
  };
}
