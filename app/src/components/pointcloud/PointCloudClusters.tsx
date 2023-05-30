import React, { useMemo } from "react";
import { interpolateSinebow } from "d3-scale-chromatic";

import { Cluster, ThreeDimensionalPoint } from "@arizeai/point-cloud";

import { usePointCloudContext } from "@phoenix/contexts";
import { CanvasTheme, ClusterColorMode } from "@phoenix/store";

import { ThreeDimensionalPointItem } from "./types";

type PointCloudClustersProps = {
  /**
   * The id of a cluster that is currently highlighted
   */
  highlightedClusterId: string | null;
  /**
   * The id of the cluster that is currently selected
   */
  selectedClusterId: string | null;
  /**
   * The radius of the points in the point cloud
   */
  radius: number;
};
export function PointCloudClusters({
  highlightedClusterId,
  selectedClusterId,
  radius,
}: PointCloudClustersProps) {
  const points = usePointCloudContext((state) => state.points);
  const clusters = usePointCloudContext((state) => state.clusters);
  const canvasTheme = usePointCloudContext((state) => state.canvasTheme);
  const clusterColorMode = usePointCloudContext(
    (state) => state.clusterColorMode
  );
  // const { selectedClusterId } = usePointCloud();
  // Keep a map of event id to position for fast lookup
  const eventPositionMap = useMemo(() => {
    return points.reduce((acc, point) => {
      acc[point.eventId] = point.position;
      return acc;
    }, {} as Record<string, ThreeDimensionalPointItem["position"] | undefined>);
  }, [points]);

  // Interleave the cluster point locations with the cluster
  const clustersWithData = useMemo(() => {
    return clusters
      .map((cluster) => {
        const { eventIds } = cluster;
        const positionData = eventIds
          .map((eventId) => ({
            position: eventPositionMap[eventId],
          }))
          .filter(
            (d): d is { position: ThreeDimensionalPoint } => d.position != null
          );
        return {
          ...cluster,
          data: positionData,
        };
      })
      .filter((cluster) => cluster.data.length > 0); // Remove empty clusters
  }, [clusters, eventPositionMap]);

  return (
    <>
      {clustersWithData.map((cluster, index) => {
        return (
          <Cluster
            key={cluster.id}
            data={cluster.data}
            opacity={clusterOpacity({
              selected: cluster.id === selectedClusterId,
              highlighted: cluster.id === highlightedClusterId,
              clusterColorMode: clusterColorMode,
            })}
            wireframe
            pointRadius={radius}
            color={clusterColor({
              canvasTheme,
              clusterColorMode,
              index,
              clusterCount: clustersWithData.length,
            })}
          />
        );
      })}
    </>
  );
}

/**
 * Determines the color of a cluster based on the canvas theme
 * and cluster coloring mode
 */
function clusterColor({
  canvasTheme,
  clusterColorMode,
  index,
  clusterCount,
}: {
  clusterColorMode: ClusterColorMode;
  canvasTheme: CanvasTheme;
  /**
   * Where the cluster is in the list of clusters
   */
  index: number;
  clusterCount: number;
}): string {
  if (clusterColorMode === ClusterColorMode.default) {
    return canvasTheme === "dark" ? "#999999" : "#555555";
  }
  return interpolateSinebow(index / clusterCount);
}

/**
 * Determines the opacity of a cluster based on the coloring mode and whether
 * the cluster is selected or highlighted
 */
function clusterOpacity({
  selected,
  highlighted,
  clusterColorMode,
}: {
  selected: boolean;
  highlighted: boolean;
  clusterColorMode: ClusterColorMode;
}): number {
  if (clusterColorMode === ClusterColorMode.highlight) {
    // Show all the clusters
    return 0.5;
  } else if (selected) {
    return 0.3;
  } else if (highlighted) {
    return 0.2;
  }
  return 0;
}
