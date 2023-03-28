import React, { useMemo } from "react";

import { Cluster } from "@arizeai/point-cloud";

import { usePointCloudContext } from "@phoenix/contexts";

import { ClusterInfo, ThreeDimensionalPointItem } from "./types";

type PointCloudClustersProps = {
  /**
   * All the points in the point cloud
   */
  points: ThreeDimensionalPointItem[];
  /**
   * The cluster definitions in the point cloud
   */
  clusters: readonly ClusterInfo[];
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
  points,
  clusters,
  highlightedClusterId,
  selectedClusterId,
  radius,
}: PointCloudClustersProps) {
  const canvasTheme = usePointCloudContext((state) => state.canvasTheme);
  // const { selectedClusterId } = usePointCloud();
  // Keep a map of point id to position for fast lookup
  const pointPositionsMap = useMemo(() => {
    return points.reduce((acc, point) => {
      acc[(point.metaData as any).id as string] = point.position;
      return acc;
    }, {} as Record<string, ThreeDimensionalPointItem["position"]>);
  }, [points]);

  // Interleave the cluster point locations with the cluster
  const clustersWithData = useMemo(() => {
    return clusters.map((cluster) => {
      const { pointIds } = cluster;
      return {
        ...cluster,
        data: pointIds.map((pointId) => ({
          position: pointPositionsMap[pointId],
        })),
      };
    });
  }, [clusters, pointPositionsMap]);

  return (
    <>
      {clustersWithData.map((cluster) => {
        let opacity = 0;
        if (cluster.id === selectedClusterId) {
          opacity = 0.2;
        } else if (cluster.id === highlightedClusterId) {
          opacity = 0.1;
        }
        return (
          <Cluster
            key={cluster.id}
            data={cluster.data}
            opacity={opacity}
            wireframe
            pointRadius={radius}
            color={canvasTheme === "dark" ? "#999999" : "#555555"}
          />
        );
      })}
    </>
  );
}
