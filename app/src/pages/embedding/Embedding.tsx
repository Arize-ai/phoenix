import React, {
  ReactNode,
  Suspense,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  graphql,
  PreloadedQuery,
  usePreloadedQuery,
  useQueryLoader,
} from "react-relay";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { subDays } from "date-fns";
import { css } from "@emotion/react";

import { Switch, TabPane, Tabs } from "@arizeai/components";

import { Loading, LoadingMask } from "@phoenix/components";
import {
  PrimaryDatasetTimeRange,
  ReferenceDatasetTimeRange,
  Toolbar,
} from "@phoenix/components/filter";
import {
  ClusterItem,
  PointCloud,
  PointCloudParameterSettings,
  ThreeDimensionalPointItem,
} from "@phoenix/components/pointcloud";
import { PointCloudDisplaySettings } from "@phoenix/components/pointcloud/PointCloudDisplaySettings";
import { resizeHandleCSS } from "@phoenix/components/resize/styles";
import { PointCloudProvider, usePointCloudContext } from "@phoenix/contexts";
import { useDatasets } from "@phoenix/contexts";
import {
  TimeSliceContextProvider,
  useTimeSlice,
} from "@phoenix/contexts/TimeSliceContext";
import { useEmbeddingDimensionId } from "@phoenix/hooks";
import {
  DEFAULT_DRIFT_POINT_CLOUD_PROPS,
  DEFAULT_SINGLE_DATASET_POINT_CLOUD_PROPS,
} from "@phoenix/store";

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
            driftRatio
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

  // Initialize the store based on whether or not there is a reference dataset
  const defaultPointCloudProps = useMemo(() => {
    return referenceDataset != null
      ? DEFAULT_DRIFT_POINT_CLOUD_PROPS
      : DEFAULT_SINGLE_DATASET_POINT_CLOUD_PROPS;
  }, [referenceDataset]);

  return (
    <PointCloudProvider {...defaultPointCloudProps}>
      <main
        css={(theme) => css`
          flex: 1 1 auto;
          display: flex;
          flex-direction: column;
          overflow: hidden;
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
          {referenceDataset && showDriftChart ? (
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
    </PointCloudProvider>
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

  const sourceData = useMemo(
    () => data.embedding?.UMAPPoints?.data ?? [],
    [data]
  );
  const referenceSourceData = useMemo(
    () => data.embedding?.UMAPPoints?.referenceData ?? [],
    [data]
  );
  const clusters = useMemo(() => {
    let clusters = data.embedding?.UMAPPoints?.clusters || [];

    // Sort the clusters by drift ratio so as to show the most drifted clusters first
    clusters = [...clusters].sort((clusterA, clusterB) => {
      let { driftRatio: driftRatioA } = clusterA;
      let { driftRatio: driftRatioB } = clusterB;
      driftRatioA = driftRatioA ?? 0;
      driftRatioB = driftRatioB ?? 0;
      if (driftRatioA > driftRatioB) {
        return -1;
      }
      if (driftRatioB < driftRatioB) {
        return 1;
      }
      return 0;
    });
    return clusters;
  }, [data.embedding?.UMAPPoints?.clusters]);

  // Construct a map of point ids to their data
  const allSourceData = useMemo(() => {
    if (referenceSourceData) {
      return [...sourceData, ...referenceSourceData];
    }
    return sourceData;
  }, [referenceSourceData, sourceData]);

  const pointIdToDataMap = useMemo(() => {
    const map = new Map<string, UMAPPointsEntry>();
    allSourceData.forEach((entry) => {
      map.set(entry.id, entry);
    });
    return map;
  }, [allSourceData]);

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
            css={css`
              .ac-tabs {
                height: 100%;
                overflow: hidden;
                .ac-tabs__pane-container {
                  height: 100%;
                  overflow-y: auto;
                }
              }
            `}
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
                <TabPane name="Parameters">
                  <PointCloudParameterSettings />
                </TabPane>
              </Tabs>
            </Panel>
          </PanelGroup>
        </Panel>
        <PanelResizeHandle css={resizeHandleCSS} />
        <Panel>
          <div
            css={css`
              position: relative;
              width: 100%;
              height: 100%;
            `}
          >
            <SelectionPanel pointIdToDataMap={pointIdToDataMap} />
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
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
};

function SelectionPanel(props: {
  pointIdToDataMap: Map<string, UMAPPointsEntry>;
}) {
  const selectedPointIds = usePointCloudContext(
    (state) => state.selectedPointIds
  );

  if (selectedPointIds.size === 0) {
    return null;
  }

  return (
    <div
      css={css`
        position: absolute;
        top: 0;
        left: 0;
        bottom: 0;
        right: 0;
      `}
      data-testid="selection-panel"
    >
      <PanelGroup direction="vertical">
        <Panel></Panel>
        <PanelResizeHandle css={resizeHandleCSS} style={{ zIndex: 1 }} />
        <Panel
          id="embedding-point-selection"
          defaultSize={40}
          minSize={20}
          order={2}
          style={{ zIndex: 1 }}
        >
          <PointSelectionPanelContentWrap>
            <Suspense fallback={<Loading />}>
              <PointSelectionPanelContent
                pointIdToDataMap={props.pointIdToDataMap}
              />
            </Suspense>
          </PointSelectionPanelContentWrap>
        </Panel>
      </PanelGroup>
    </div>
  );
}

/**
 * Wraps the content of the point selection panel so that it can be styled
 */
function PointSelectionPanelContentWrap(props: { children: ReactNode }) {
  return (
    <div
      css={(theme) => css`
        background-color: ${theme.colors.gray900};
        width: 100%;
        height: 100%;
      `}
    >
      {props.children}
    </div>
  );
}
function ClustersPanelContents({
  clusters,
}: {
  clusters: readonly UMAPClusterEntry[];
}) {
  const selectedClusterId = usePointCloudContext(
    (state) => state.selectedClusterId
  );
  const setSelectedClusterId = usePointCloudContext(
    (state) => state.setSelectedClusterId
  );
  const setSelectedPointIds = usePointCloudContext(
    (state) => state.setSelectedPointIds
  );

  return (
    // @ts-expect-error add more tabs
    <Tabs>
      <TabPane name="Clusters">
        <ul
          css={(theme) =>
            css`
              flex: 1 1 auto;
              overflow-y: auto;
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
                  driftRatio={cluster.driftRatio}
                  onClick={() => {
                    setSelectedClusterId(cluster.id);
                    setSelectedPointIds(new Set(cluster.pointIds));
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
