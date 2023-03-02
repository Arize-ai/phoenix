/**
 * Definitions for the color groups as determined by the coloring strategy.
 */

import {
  ColoringStrategy,
  CorrectnessGroup,
  DatasetGroup,
} from "@phoenix/types";
import { assertUnreachable } from "@phoenix/typeUtils";

import { ThreeDimensionalPointItem } from "./types";

export function getPointDatasetGroup(
  point: ThreeDimensionalPointItem
): DatasetGroup {
  return point.metaData.id.includes("PRIMARY")
    ? DatasetGroup.primary
    : DatasetGroup.reference;
}

export function getPointCorrectnessGroup(
  point: ThreeDimensionalPointItem
): CorrectnessGroup {
  const { predictionLabel, actualLabel } = point.metaData;

  if (predictionLabel === null || actualLabel === null) {
    return CorrectnessGroup.unknown;
  }
  if (predictionLabel === actualLabel) {
    return CorrectnessGroup.correct;
  } else {
    return CorrectnessGroup.incorrect;
  }
}

/**
 * A curried function that maps a point to a color group based on the given coloring strategy.
 * @param coloringStrategy
 * @param fallbackGroup - The group to return if the coloring strategy is not determined by the point itself
 * @returns
 */
export const getPointColorGroup =
  (coloringStrategy: ColoringStrategy) =>
  (point: ThreeDimensionalPointItem): string => {
    switch (coloringStrategy) {
      case ColoringStrategy.dataset:
        return getPointDatasetGroup(point);
      case ColoringStrategy.correctness:
        return getPointCorrectnessGroup(point);
      default:
        assertUnreachable(coloringStrategy);
    }
  };
