import React from "react";
import { graphql, useMutation } from "react-relay";

import { ActionMenu, Icon, Icons, Item } from "@arizeai/components";

import { useGlobalNotification, usePointCloudContext } from "@phoenix/contexts";

import { EmbeddingActionMenuExportClustersMutation } from "./__generated__/EmbeddingActionMenuExportClustersMutation.graphql";

export function EmbeddingActionMenu() {
  const clusters = usePointCloudContext((state) => state.clusters);
  const { notifyError, notifySuccess } = useGlobalNotification();
  const [commitExportCluster, isExportInFlight] =
    useMutation<EmbeddingActionMenuExportClustersMutation>(graphql`
      mutation EmbeddingActionMenuExportClustersMutation(
        $clusters: [ClusterInput!]!
      ) {
        exportClusters(clusters: $clusters) {
          fileName
        }
      }
    `);

  return (
    <ActionMenu
      align="end"
      icon={isExportInFlight ? <Icon svg={<Icons.LoadingOutline />} /> : null}
      onAction={(action) => {
        switch (action) {
          case "export_cluster":
            commitExportCluster({
              variables: {
                clusters: clusters.map((cluster) => ({
                  eventIds: cluster.eventIds,
                  id: cluster.id,
                })),
              },
              onCompleted: (data) => {
                const { fileName } = data.exportClusters;
                notifySuccess({
                  title: "Clusters exported",
                  message: `dataframe is available via px.active_session().exports or can be downloaded by clicking below`,

                  action: {
                    text: "Download",
                    onClick: () => {
                      window.open(`/exports?filename=${fileName}`, "_self");
                    },
                  },
                });
              },
              onError: (error) => {
                notifyError({
                  title: "Failed to export clusters",
                  message: `Failed to export clusters: ${error.message}`,
                });
              },
            });
            break;
        }
      }}
    >
      <Item key="export_cluster">
        <Icon svg={<Icons.Download />} />
        Export clusters
      </Item>
    </ActionMenu>
  );
}
