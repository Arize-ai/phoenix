import React from "react";
import { shade } from "polished";
import { Points, PointBaseProps } from "@arizeai/point-cloud";
import { useCallback, useMemo } from "react";
import { PointColor, ThreeDimensionalPointItem } from "./types";

const DIM_AMOUNT = 0.5;

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
  primaryColor: PointColor;
  referenceColor: PointColor;
  selectedIds: Set<string>;
};
export function PointCloudPoints({
  primaryData,
  referenceData,
  selectedIds,
  primaryColor,
  referenceColor,
}: PointCloudPointsProps) {
  /** Colors to represent a dimmed variant of the color for "un-selected" */
  const dimmedPrimaryColor = useMemo<PointColor>(() => {
    if (typeof primaryColor === "function") {
      return (p: PointBaseProps) => shade(DIM_AMOUNT)(primaryColor(p));
    }
    return shade(DIM_AMOUNT, primaryColor);
  }, [primaryColor]);

  const dimmedReferenceColor = useMemo<PointColor>(() => {
    if (typeof referenceColor === "function") {
      return (p: PointBaseProps) => shade(DIM_AMOUNT)(referenceColor(p));
    }
    return shade(DIM_AMOUNT, referenceColor);
  }, [referenceColor]);

  const primaryColorByFn = useCallback(
    (point: PointBaseProps) => {
      if (!selectedIds.has(point.metaData.id) && selectedIds.size > 0) {
        return invokeColor(point, dimmedPrimaryColor);
      }
      return invokeColor(point, primaryColor);
    },
    [selectedIds, primaryColor, dimmedPrimaryColor]
  );

  const referenceColorByFn = useCallback(
    (point: PointBaseProps) => {
      if (!selectedIds.has(point.metaData.id) && selectedIds.size > 0) {
        return invokeColor(point, dimmedReferenceColor);
      }
      return invokeColor(point, referenceColor);
    },
    [referenceColor, selectedIds, dimmedReferenceColor]
  );

  return (
    <>
      <Points data={primaryData} pointProps={{ color: primaryColorByFn }} />
      {referenceData && (
        <Points
          data={referenceData}
          pointProps={{ color: referenceColorByFn, size: 5 }}
        />
      )}
    </>
  );
}
