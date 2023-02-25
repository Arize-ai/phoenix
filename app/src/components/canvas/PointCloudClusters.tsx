import React, { useMemo } from "react";
import { Cluster } from "@arizeai/point-cloud";
import { ClusterItem, ThreeDimensionalPointItem } from "./types";

type PointCloudClustersProps = {
  /**
   * All the points in the point cloud
   */
  points: ThreeDimensionalPointItem[];
  /**
   * The cluster definitions in the point cloud
   */
  clusters: readonly ClusterItem[];
  /**
   * The id of the cluster that is currently selected
   */
  selectedClusterId: string | null;
};
export function PointCloudClusters({
  points,
  clusters,
  selectedClusterId,
}: PointCloudClustersProps) {
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
      {clustersWithData.map((cluster) => (
        <Cluster
          key={cluster.id}
          data={cluster.data}
          opacity={cluster.id === selectedClusterId ? 0.2 : 0}
          wireframe
        />
      ))}
    </>
  );
}
