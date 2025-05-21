import { useMemo } from "react";
import { interpolateSinebow } from "d3-scale-chromatic";

import { ProviderTheme } from "@arizeai/components";
import { Cluster, ThreeDimensionalPoint } from "@arizeai/point-cloud";

import { usePointCloudContext, useTheme } from "@phoenix/contexts";
import { ClusterColorMode } from "@phoenix/store";

type PointCloudClustersProps = {
  /**
   * The radius of the points in the point cloud
   */
  radius: number;
};
export function PointCloudClusters({ radius }: PointCloudClustersProps) {
  const eventIdToDataMap = usePointCloudContext(
    (state) => state.eventIdToDataMap
  );
  const highlightedClusterId = usePointCloudContext(
    (state) => state.highlightedClusterId
  );
  const selectedClusterId = usePointCloudContext(
    (state) => state.selectedClusterId
  );
  const clusters = usePointCloudContext((state) => state.clusters);
  const { theme } = useTheme();
  const clusterColorMode = usePointCloudContext(
    (state) => state.clusterColorMode
  );

  // Interleave the cluster point locations with the cluster
  const clustersWithData = useMemo(() => {
    return clusters
      .map((cluster) => {
        const { eventIds } = cluster;
        const positionData = eventIds
          .map((eventId) => {
            const position = eventIdToDataMap.get(eventId)?.position;
            return {
              position,
            };
          })
          .filter(
            (
              positionInfo
            ): positionInfo is { position: ThreeDimensionalPoint } =>
              positionInfo.position !== null
          );
        return {
          ...cluster,
          data: positionData,
        };
      })
      .filter((cluster) => cluster.data.length > 0); // Remove empty clusters
  }, [clusters, eventIdToDataMap]);

  return (
    <>
      {clustersWithData.map((cluster, index) => {
        const opacity = clusterOpacity({
          selected: cluster.id === selectedClusterId,
          highlighted: cluster.id === highlightedClusterId,
          clusterColorMode: clusterColorMode,
        });
        return (
          <Cluster
            key={`${cluster.id}__opacity_${String(opacity)}`} // NB: since the cluster id is not fully unique, we need to add the opacity to the key
            data={cluster.data}
            opacity={opacity}
            wireframe
            pointRadius={radius}
            color={clusterColor({
              theme,
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
  theme,
  clusterColorMode,
  index,
  clusterCount,
}: {
  clusterColorMode: ClusterColorMode;
  theme: ProviderTheme;
  /**
   * Where the cluster is in the list of clusters
   */
  index: number;
  clusterCount: number;
}): string {
  if (clusterColorMode === ClusterColorMode.default) {
    return theme === "dark" ? "#999999" : "#bbbbbb";
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
    return 1;
  } else if (selected) {
    return 0.7;
  } else if (highlighted) {
    return 0.5;
  }
  return 0;
}
