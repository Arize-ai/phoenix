import { useCategoryChartColors } from "@phoenix/components/chart";

export function useExperimentColors() {
  const colors = useCategoryChartColors();
  const colorValues = Object.values(colors);
  const numColors = colorValues.length;

  function getExperimentColor(experimentIndex: number) {
    return colorValues[experimentIndex % numColors];
  }
  return {
    getExperimentColor,
    baseExperimentColor: "var(--ac-global-color-grey-700)",
  };
}
