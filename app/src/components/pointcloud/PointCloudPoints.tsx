import React, { startTransition } from "react";
import { useCallback, useMemo } from "react";
import debounce from "lodash/debounce";
import { lighten, shade } from "polished";

import { PointBaseProps, Points } from "@arizeai/point-cloud";

import { ColoringStrategy } from "@phoenix/constants/pointCloudConstants";
import { usePointCloudContext, useTheme } from "@phoenix/contexts";
import { Point } from "@phoenix/store";

import { PointColor } from "./types";

const SHADE_AMOUNT = 0.5;
const LIGHTEN_AMOUNT = 0.3;

/**
 * The amount of time to debounce the hover events
 */
const DEBOUNCE_WAIT = 100;

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
  primaryData: Point[];
  /**
   * Optional second set of data to display in the point cloud
   */
  referenceData: Point[] | null;
  /**
   * Optional set of data for the corpus (typically a knowledge base in a vector store)
   */
  corpusData: Point[] | null;
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
  corpusData,
  color,
  radius,
}: PointCloudPointsProps) {
  const datasetVisibility = usePointCloudContext(
    (state) => state.datasetVisibility
  );
  const coloringStrategy = usePointCloudContext(
    (state) => state.coloringStrategy
  );
  const { theme } = useTheme();
  const setSelectedEventIds = usePointCloudContext(
    (state) => state.setSelectedEventIds
  );
  const selectedEventIds = usePointCloudContext(
    (state) => state.selectedEventIds
  );
  const setSelectedClusterId = usePointCloudContext(
    (state) => state.setSelectedClusterId
  );
  const setHoveredEventId = usePointCloudContext(
    (state) => state.setHoveredEventId
  );
  const pointSizeScale = usePointCloudContext((state) => state.pointSizeScale);

  const debouncedSetHoveredEventId = useMemo(() => {
    return debounce(setHoveredEventId, DEBOUNCE_WAIT);
  }, [setHoveredEventId]);

  // Only use a cube shape if the coloring strategy is not dataset
  const referenceDatasetPointShape = useMemo(
    () => (coloringStrategy !== ColoringStrategy.dataset ? "cube" : "sphere"),
    [coloringStrategy]
  );
  const corpusDatasetPointShape = useMemo(
    () =>
      coloringStrategy !== ColoringStrategy.dataset ? "octahedron" : "sphere",
    [coloringStrategy]
  );

  const colorDimFn = useMemo(() => {
    return theme === "dark" ? shade(SHADE_AMOUNT) : lighten(LIGHTEN_AMOUNT);
  }, [theme]);

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
        !selectedEventIds.has(point.metaData.id) &&
        selectedEventIds.size > 0
      ) {
        return invokeColor(point, dimmedColor);
      }
      return invokeColor(point, color);
    },
    [selectedEventIds, color, dimmedColor]
  );

  const showReferencePoints = datasetVisibility.reference && referenceData;
  const showCorpusPoints = datasetVisibility.corpus && corpusData;

  const onPointClicked = useCallback(
    (point: PointBaseProps) => {
      startTransition(() => {
        setSelectedEventIds(new Set([point.metaData.id]));
        setSelectedClusterId(null);
      });
    },
    [setSelectedClusterId, setSelectedEventIds]
  );
  const onPointHovered = useCallback(
    (point: PointBaseProps) => {
      // NB: point can be undefined
      if (point == null || point.metaData == null) {
        return;
      }
      debouncedSetHoveredEventId(point.metaData.id);
    },
    [debouncedSetHoveredEventId]
  );

  const onPointerLeave = useCallback(() => {
    debouncedSetHoveredEventId(null);
  }, [debouncedSetHoveredEventId]);

  return (
    <>
      {datasetVisibility.primary ? (
        <Points
          data={primaryData}
          pointProps={{ color: colorByFn, radius, scale: pointSizeScale }}
          onPointClicked={onPointClicked}
          onPointHovered={onPointHovered}
          onPointerLeave={onPointerLeave}
        />
      ) : null}
      {showReferencePoints ? (
        <Points
          data={referenceData}
          pointProps={{
            color: colorByFn,
            radius,
            size: radius ? radius * CUBE_RADIUS_MULTIPLIER : undefined,
            scale: pointSizeScale,
          }}
          onPointHovered={onPointHovered}
          onPointerLeave={onPointerLeave}
          pointShape={referenceDatasetPointShape}
          onPointClicked={onPointClicked}
        />
      ) : null}
      {showCorpusPoints ? (
        <Points
          data={corpusData}
          pointProps={{
            color: colorByFn,
            radius,
            size: radius ? radius * CUBE_RADIUS_MULTIPLIER : undefined,
            scale: pointSizeScale,
          }}
          onPointHovered={onPointHovered}
          onPointerLeave={onPointerLeave}
          pointShape={corpusDatasetPointShape}
          onPointClicked={onPointClicked}
        />
      ) : null}
    </>
  );
}
