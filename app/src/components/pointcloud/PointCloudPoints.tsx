import React, { startTransition } from "react";
import { useCallback, useMemo } from "react";
import { lighten, shade } from "polished";

import { PointBaseProps, Points } from "@arizeai/point-cloud";

import { ColoringStrategy } from "@phoenix/constants/pointCloudConstants";
import { usePointCloudContext } from "@phoenix/contexts";

import { PointColor, ThreeDimensionalPointItem } from "./types";

const SHADE_AMOUNT = 0.5;
const LIGHTEN_AMOUNT = 0.3;

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
  radius: number;
};

/**
 * Function component that renders the points in the point cloud
 * Split out into it's own component to maximize performance and caching
 */
export function PointCloudPoints({
  primaryData,
  referenceData,
  color,
  radius,
}: PointCloudPointsProps) {
  const datasetVisibility = usePointCloudContext(
    (state) => state.datasetVisibility
  );
  const coloringStrategy = usePointCloudContext(
    (state) => state.coloringStrategy
  );
  const canvasTheme = usePointCloudContext((state) => state.canvasTheme);
  const setSelectedPointIds = usePointCloudContext(
    (state) => state.setSelectedPointIds
  );
  const selectedPointIds = usePointCloudContext(
    (state) => state.selectedPointIds
  );
  const setSelectedClusterId = usePointCloudContext(
    (state) => state.setSelectedClusterId
  );

  // Only use a cube shape if the coloring strategy is not dataset
  const referenceDatasetPointShape = useMemo(
    () => (coloringStrategy !== ColoringStrategy.dataset ? "cube" : "sphere"),
    [coloringStrategy]
  );

  const colorDimFn = useMemo(() => {
    return canvasTheme === "dark"
      ? shade(SHADE_AMOUNT)
      : lighten(LIGHTEN_AMOUNT);
  }, [canvasTheme]);

  /** Colors to represent a dimmed variant of the color for "un-selected" */
  const dimmedColor = useMemo<PointColor>(() => {
    if (typeof color === "function") {
      return (p: PointBaseProps) => colorDimFn(color(p));
    }
    return colorDimFn(color);
  }, [color, colorDimFn]);

  const colorByFn = useCallback(
    (point: PointBaseProps) => {
      if (
        !selectedPointIds.has(point.metaData.id) &&
        selectedPointIds.size > 0
      ) {
        return invokeColor(point, dimmedColor);
      }
      return invokeColor(point, color);
    },
    [selectedPointIds, color, dimmedColor]
  );

  const showReferencePoints = datasetVisibility.reference && referenceData;

  const onPointClicked = useCallback(
    (point: PointBaseProps) => {
      startTransition(() => {
        setSelectedPointIds(new Set([point.metaData.id]));
        setSelectedClusterId(null);
      });
    },
    [setSelectedClusterId, setSelectedPointIds]
  );

  return (
    <>
      {datasetVisibility.primary ? (
        <Points
          data={primaryData}
          pointProps={{ color: colorByFn, radius }}
          onPointClicked={onPointClicked}
        />
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
          onPointClicked={onPointClicked}
        />
      ) : null}
    </>
  );
}
