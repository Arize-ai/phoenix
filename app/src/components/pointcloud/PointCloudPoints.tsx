import React from "react";
import { useCallback, useMemo } from "react";
import { shade } from "polished";

import { PointBaseProps, Points } from "@arizeai/point-cloud";

import { usePointCloudContext } from "@phoenix/contexts";
import { ColoringStrategy } from "@phoenix/types";

import { PointColor, ThreeDimensionalPointItem } from "./types";

const DIM_AMOUNT = 0.5;

/**
 * The amount to multiply the radius by to get the appropriate cube size
 * E.g. size = radius * CUBE_RADIUS_MULTIPLIER
 */
const CUBE_RADIUS_MULTIPLIER = 1.7;

/**
 * Invokes the color function if it is a function, otherwise returns the color
 * @param point
 * @param color
 * @returns {string} colorString
 */
function invokeColor(point: PointBaseProps, color: PointColor) {
  if (typeof color === "function") {
    return color(point);
  }
  return color;
}
type PointCloudPointsProps = {
  /**
   * The primary data to display in the point cloud
   */
  primaryData: ThreeDimensionalPointItem[];
  /**
   * Optional second set of data to display in the point cloud
   */
  referenceData: ThreeDimensionalPointItem[] | null;
  /**
   * How the points should be colored
   */
  color: PointColor;
  selectedIds: Set<string>;
  radius: number;
};

/**
 * Function component that renders the points in the point cloud
 * Split out into it's own component to maximize performance and caching
 */
export function PointCloudPoints({
  primaryData,
  referenceData,
  selectedIds,
  color,
  radius,
}: PointCloudPointsProps) {
  const { datasetVisibility, coloringStrategy } = usePointCloudContext(
    (state) => {
      return {
        datasetVisibility: state.datasetVisibility,
        coloringStrategy: state.coloringStrategy,
      };
    }
  );

  // Only use a cube shape if the coloring strategy is not dataset
  const referenceDatasetPointShape = useMemo(
    () => (coloringStrategy !== ColoringStrategy.dataset ? "cube" : "sphere"),
    [coloringStrategy]
  );

  /** Colors to represent a dimmed variant of the color for "un-selected" */
  const dimmedColor = useMemo<PointColor>(() => {
    if (typeof color === "function") {
      return (p: PointBaseProps) => shade(DIM_AMOUNT)(color(p));
    }
    return shade(DIM_AMOUNT, color);
  }, [color]);

  const colorByFn = useCallback(
    (point: PointBaseProps) => {
      if (!selectedIds.has(point.metaData.id) && selectedIds.size > 0) {
        return invokeColor(point, dimmedColor);
      }
      const colorStr = invokeColor(point, color);
      return colorStr;
    },
    [selectedIds, color, dimmedColor]
  );

  const showReferencePoints = datasetVisibility.reference && referenceData;

  return (
    <>
      {datasetVisibility.primary ? (
        <Points data={primaryData} pointProps={{ color: colorByFn, radius }} />
      ) : null}
      {showReferencePoints ? (
        <Points
          data={referenceData}
          pointProps={{
            color: colorByFn,
            radius,
            size: radius ? radius * CUBE_RADIUS_MULTIPLIER : undefined,
          }}
          pointShape={referenceDatasetPointShape}
        />
      ) : null}
    </>
  );
}
