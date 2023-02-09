import { ColoringStrategy, PointColor } from "./types";

type ColoringConfig = {
  coloringStrategy: ColoringStrategy;
  defaultColor: string;
};

/**
 * A curried function that generates a color function based on the given config.
 * @param {ColoringConfig} config
 * @returns {ColorFn}
 */
export const createColorFn =
  (config: ColoringConfig): PointColor =>
  (_point) => {
    const { coloringStrategy, defaultColor } = config;
    switch (coloringStrategy) {
      case ColoringStrategy.dataset:
        return defaultColor;
      case ColoringStrategy.correctness:
        return "green";
    }
  };
