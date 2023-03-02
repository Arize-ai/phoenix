import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  graphql,
  PreloadedQuery,
  usePreloadedQuery,
  useQueryLoader,
} from "react-relay";
import {
  ImperativePanelHandle,
  Panel,
  PanelGroup,
  PanelResizeHandle,
} from "react-resizable-panels";
import { subDays } from "date-fns";
import { css } from "@emotion/react";

import { Switch, TabPane, Tabs } from "@arizeai/components";

import { Loading, LoadingMask } from "@phoenix/components";
import {
  PointCloud,
  ThreeDimensionalPointItem,
} from "@phoenix/components/canvas";
import { PointCloudDisplaySettings } from "@phoenix/components/canvas/PointCloudDisplaySettings";
import { ClusterItem } from "@phoenix/components/cluster";
import {
  PrimaryDatasetTimeRange,
  ReferenceDatasetTimeRange,
  Toolbar,
} from "@phoenix/components/filter";
import { resizeHandleCSS } from "@phoenix/components/resize/styles";
import { useDatasets } from "@phoenix/contexts";
import {
  TimeSliceContextProvider,
  useTimeSlice,
} from "@phoenix/contexts/TimeSliceContext";
import { useEmbeddingDimensionId } from "@phoenix/hooks";
import { usePointCloudStore } from "@phoenix/store";

import {
  EmbeddingUMAPQuery as UMAPQueryType,
  EmbeddingUMAPQuery$data,
} from "./__generated__/EmbeddingUMAPQuery.graphql";
import { EuclideanDistanceTimeSeries } from "./EuclideanDistanceTimeSeries";
import { PointSelectionPanelContent } from "./PointSelectionPanelContent";

type UMAPPointsEntry = NonNullable<
  EmbeddingUMAPQuery$data["embedding"]["UMAPPoints"]
>["data"][number];

type UMAPClusterEntry = NonNullable<
  EmbeddingUMAPQuery$data["embedding"]["UMAPPoints"]
>["clusters"][number];

const EmbeddingUMAPQuery = graphql`
  query EmbeddingUMAPQuery($id: GlobalID!, $timeRange: TimeRange!) {
    embedding: node(id: $id) {
      ... on EmbeddingDimension {
        UMAPPoints(timeRange: $timeRange) {
          data {
            id
            coordinates {
              __typename
              ... on Point3D {
                x
                y
                z
              }
              ... on Point2D {
                x
                y
              }
            }
            embeddingMetadata {
              linkToData
              rawData
            }
            eventMetadata {
              predictionLabel
              actualLabel
              predictionScore
              actualScore
            }
          }
          referenceData {
            id
            coordinates {
              __typename
              ... on Point3D {
                x
                y
                z
              }
              ... on Point2D {
                x
                y
              }
            }
            embeddingMetadata {
              linkToData
              rawData
            }
            eventMetadata {
              predictionLabel
              actualLabel
              predictionScore
              actualScore
            }
          }
          clusters {
            id
            pointIds
          }
        }
      }
    }
  }
`;

export function Embedding() {
  return (
    <TimeSliceContextProvider>
      <EmbeddingMain />
    </TimeSliceContextProvider>
  );
}

function EmbeddingMain() {
  const embeddingDimensionId = useEmbeddingDimensionId();
  const { primaryDataset, referenceDataset } = useDatasets();
  const [showDriftChart, setShowDriftChart] = useState<boolean>(true);
  const [queryReference, loadQuery] =
    useQueryLoader<UMAPQueryType>(EmbeddingUMAPQuery);
  const { selectedTimestamp } = useTimeSlice();
  const endTime = useMemo(
    () => selectedTimestamp ?? new Date(primaryDataset.endTime),
    [selectedTimestamp, primaryDataset.endTime]
  );
  const timeRange = useMemo(() => {
    return {
      start: subDays(endTime, 2).toISOString(),
      end: endTime.toISOString(),
    };
  }, [endTime]);

  // Load the query on first render
  useEffect(() => {
    loadQuery(
      {
        id: embeddingDimensionId,
        timeRange,
      },
      {
        fetchPolicy: "network-only",
      }
    );
  }, [embeddingDimensionId, loadQuery, timeRange]);

  return (
    <main
      css={(theme) => css`
        flex: 1 1 auto;
        height: 100%;
        background-color: ${theme.colors.gray900};
      `}
    >
      <Toolbar
        extra={
          referenceDataset ? (
            <Switch
              onChange={(isSelected) => {
                setShowDriftChart(isSelected);
              }}
              defaultSelected={true}
              labelPlacement="start"
            >
              Show Drift Chart
            </Switch>
          ) : null
        }
      >
        <PrimaryDatasetTimeRange />
        {referenceDataset ? (
          <ReferenceDatasetTimeRange
            datasetType="reference"
            timeRange={{
              start: new Date(referenceDataset.startTime),
              end: new Date(referenceDataset.endTime),
            }}
          />
        ) : null}
      </Toolbar>
      <PanelGroup direction="vertical">
        {showDriftChart ? (
          <>
            <Panel defaultSize={15} collapsible order={1}>
              <Suspense fallback={<Loading />}>
                <EuclideanDistanceTimeSeries
                  embeddingDimensionId={embeddingDimensionId}
                />
              </Suspense>
            </Panel>
            <PanelResizeHandle css={resizeHandleCSS} />
          </>
        ) : null}
        <Panel order={2}>
          <div
            css={css`
              flex: 1 1 auto;
              width: 100%;
              height: 100%;
              position: relative;
            `}
          >
            <Suspense fallback={<LoadingMask />}>
              {queryReference ? (
                <PointCloudDisplay queryReference={queryReference} />
              ) : null}
            </Suspense>
          </div>
        </Panel>
      </PanelGroup>
    </main>
  );
}

function umapDataEntryToThreeDimensionalPointItem(
  umapData: UMAPPointsEntry
): ThreeDimensionalPointItem {
  const { id, coordinates, eventMetadata, embeddingMetadata } = umapData;
  if (!coordinates) {
    throw new Error("No coordinates found for UMAP data entry");
  }
  if (coordinates.__typename !== "Point3D") {
    throw new Error(
      `Expected Point3D but got ${coordinates.__typename} for UMAP data entry`
    );
  }

  return {
    position: [coordinates.x, coordinates.y, coordinates.z],
    metaData: {
      id,
      ...eventMetadata,
      ...embeddingMetadata,
    },
  };
}

/**
 * Fetches the umap data for the embedding dimension and passes the data to the point cloud
 */
const PointCloudDisplay = ({
  queryReference,
}: {
  queryReference: PreloadedQuery<UMAPQueryType>;
}) => {
  const data = usePreloadedQuery<UMAPQueryType>(
    EmbeddingUMAPQuery,
    queryReference
  );

  const sourceData = data.embedding?.UMAPPoints?.data ?? [];
  const referenceSourceData = data.embedding?.UMAPPoints?.referenceData;
  const clusters = data.embedding?.UMAPPoints?.clusters || [];

  return (
    <div
      css={css`
        flex: 1 1 auto;
        display: flex;
        flex-direction: row;
        align-items: stretch;
        width: 100%;
        height: 100%;
      `}
      data-testid="point-cloud-display"
    >
      <PanelGroup direction="horizontal">
        <Panel
          id="embedding-left"
          defaultSize={15}
          maxSize={30}
          minSize={10}
          collapsible
        >
          <PanelGroup
            autoSaveId="embedding-controls-vertical"
            direction="vertical"
          >
            <Panel>
              <ClustersPanelContents clusters={clusters} />
            </Panel>
            <PanelResizeHandle css={resizeHandleCSS} />
            <Panel>
              <Tabs>
                <TabPane name="Display">
                  <PointCloudDisplaySettings />
                </TabPane>
                <TabPane name="Parameters">Parameters</TabPane>
              </Tabs>
            </Panel>
          </PanelGroup>
        </Panel>
        <PanelResizeHandle css={resizeHandleCSS} />
        <Panel>
          <PanelGroup direction="vertical">
            <Panel order={1}>
              <PointCloud
                primaryData={
                  sourceData.map(umapDataEntryToThreeDimensionalPointItem) ?? []
                }
                referenceData={
                  referenceSourceData
                    ? referenceSourceData.map(
                        umapDataEntryToThreeDimensionalPointItem
                      )
                    : null
                }
                clusters={clusters}
              />
            </Panel>
            <PanelResizeHandle css={resizeHandleCSS} />
            <SelectionPanel />
          </PanelGroup>
        </Panel>
      </PanelGroup>
    </div>
  );
};

function SelectionPanel() {
  const selectedPointIds = usePointCloudStore(
    (state) => state.selectedPointIds
  );
  const selectionPanelRef = useRef<ImperativePanelHandle>(null);

  if (selectedPointIds.size === 0) {
    return null;
  }

  return (
    <Panel
      id="embedding-point-selection"
      defaultSize={20}
      minSize={20}
      collapsible
      order={2}
      ref={selectionPanelRef}
    >
      <Suspense fallback={"Loading..."}>
        <PointSelectionPanelContent />
      </Suspense>
    </Panel>
  );
}

function ClustersPanelContents({
  clusters,
}: {
  clusters: readonly UMAPClusterEntry[];
}) {
  const selectedClusterId = usePointCloudStore(
    (state) => state.selectedClusterId
  );
  const setSelectedClusterId = usePointCloudStore(
    (state) => state.setSelectedClusterId
  );

  return (
    // @ts-expect-error add more tabs
    <Tabs>
      <TabPane name="Clusters">
        <ul
          css={(theme) =>
            css`
              display: flex;
              flex-direction: column;
              gap: ${theme.spacing.margin8}px;
              margin: ${theme.spacing.margin8}px;
            `
          }
        >
          {clusters.map((cluster) => {
            return (
              <li key={cluster.id}>
                <ClusterItem
                  clusterId={cluster.id}
                  numPoints={cluster.pointIds.length}
                  isSelected={selectedClusterId === cluster.id}
                  onClick={() => {
                    setSelectedClusterId(cluster.id);
                  }}
                />
              </li>
            );
          })}
        </ul>
      </TabPane>
    </Tabs>
  );
}
