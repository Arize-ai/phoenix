import { ColoringStrategy, PointColor } from "./types";
import { ColorSchemes } from "@arizeai/point-cloud";

type ColoringConfig = {
  coloringStrategy: ColoringStrategy;
  defaultColor: string;
};

const colorByCorrectness: PointColor = (point) => {
  const {
    metaData: { predictionLabel, actualLabel },
  } = point;
  if (predictionLabel === actualLabel) {
    return ColorSchemes.Discrete2.LightBlueOrange[0];
  } else {
    return ColorSchemes.Discrete2.LightBlueOrange[1];
  }
};

/**
 * A curried function that generates a color function based on the given config.
 * @param {ColoringConfig} config
 * @returns {ColorFn}
 */
export const createColorFn =
  (config: ColoringConfig): PointColor =>
  (point) => {
    const { coloringStrategy, defaultColor } = config;
    switch (coloringStrategy) {
      case ColoringStrategy.dataset:
        return defaultColor;
      case ColoringStrategy.correctness:
        return colorByCorrectness(point);
    }
  };
