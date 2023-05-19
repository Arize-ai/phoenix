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

import { Counter, Switch, TabPane, Tabs } from "@arizeai/components";

import { Loading, LoadingMask } from "@phoenix/components";
import {
  PrimaryDatasetTimeRange,
  ReferenceDatasetTimeRange,
  Toolbar,
} from "@phoenix/components/filter";
import {
  ClusterItem,
  HDBSCANParameterSettings,
  PointCloud,
  ThreeDimensionalPointItem,
  UMAPParameterSettings,
} from "@phoenix/components/pointcloud";
import ClusteringSettings from "@phoenix/components/pointcloud/ClusteringSettings";
import { PointCloudDisplaySettings } from "@phoenix/components/pointcloud/PointCloudDisplaySettings";
import {
  compactResizeHandleCSS,
  resizeHandleCSS,
} from "@phoenix/components/resize/styles";
import {
  PointCloudProvider,
  useGlobalNotification,
  usePointCloudContext,
} from "@phoenix/contexts";
import { useDatasets } from "@phoenix/contexts";
import { useTimeRange } from "@phoenix/contexts/TimeRangeContext";
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
import { CountTimeSeries } from "./CountTimeSeries";
import { EuclideanDistanceTimeSeries } from "./EuclideanDistanceTimeSeries";
import { PointSelectionPanelContent } from "./PointSelectionPanelContent";

type UMAPPointsEntry = NonNullable<
  EmbeddingUMAPQuery$data["embedding"]["UMAPPoints"]
>["data"][number];

type UMAPClusterEntry = NonNullable<
  EmbeddingUMAPQuery$data["embedding"]["UMAPPoints"]
>["clusters"][number];
const DEFAULT_RANDOM_SEED = 1234567890;
const EmbeddingUMAPQuery = graphql`
  query EmbeddingUMAPQuery(
    $id: GlobalID!
    $dataSelector: DataSelector!
    $dimensionalityReducer: DimensionalityReducer!
    $clustersFinder: ClustersFinder!
  ) {
    embedding: node(id: $id) {
      ... on EmbeddingDimension {
        UMAPPoints(
          dataSelector: $dataSelector
          dimensionalityReducer: $dimensionalityReducer
          clustersFinder: $clustersFinder
        ) {
          data {
            id
            eventId
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
            eventId
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
            eventIds
            driftRatio
          }
        }
      }
    }
  }
`;

export function Embedding() {
  const { referenceDataset } = useDatasets();
  const { timeRange } = useTimeRange();
  // Initialize the store based on whether or not there is a reference dataset
  const defaultPointCloudProps = useMemo(() => {
    return referenceDataset != null
      ? DEFAULT_DRIFT_POINT_CLOUD_PROPS
      : DEFAULT_SINGLE_DATASET_POINT_CLOUD_PROPS;
  }, [referenceDataset]);
  return (
    <TimeSliceContextProvider initialTimestamp={new Date(timeRange.end)}>
      <PointCloudProvider {...defaultPointCloudProps}>
        <EmbeddingMain />
      </PointCloudProvider>
    </TimeSliceContextProvider>
  );
}

function EmbeddingMain() {
  const embeddingDimensionId = useEmbeddingDimensionId();
  const { primaryDataset, referenceDataset } = useDatasets();
  const nSamples = usePointCloudContext((state) => state.nSamples);
  const umapParameters = usePointCloudContext((state) => state.umapParameters);
  const hdbscanParameters = usePointCloudContext(
    (state) => state.hdbscanParameters
  );
  const resetPointCloud = usePointCloudContext((state) => state.reset);
  const [showChart, setShowChart] = useState<boolean>(true);
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
    // dispose of the selections in the context
    resetPointCloud();
    loadQuery(
      {
        id: embeddingDimensionId,
        dataSelector: {
          timeRange,
          dataSampler: { seed: DEFAULT_RANDOM_SEED, nSamples },
        },
        dimensionalityReducer: { umap: umapParameters },
        clustersFinder: { hdbscan: hdbscanParameters },
      },
      {
        fetchPolicy: "network-only",
      }
    );
  }, [
    resetPointCloud,
    embeddingDimensionId,
    loadQuery,
    nSamples,
    umapParameters,
    hdbscanParameters,
    timeRange,
  ]);

  return (
    <main
      css={(theme) => css`
        flex: 1 1 auto;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        background-color: ${theme.colors.gray900};
      `}
    >
      <PointCloudNotifications />
      <Toolbar
        extra={
          <Switch
            onChange={(isSelected) => {
              setShowChart(isSelected);
            }}
            defaultSelected={true}
            labelPlacement="start"
          >
            Show Timeseries
          </Switch>
        }
      >
        <PrimaryDatasetTimeRange />
        {referenceDataset ? (
          <ReferenceDatasetTimeRange
            datasetRole="reference"
            timeRange={{
              start: new Date(referenceDataset.startTime),
              end: new Date(referenceDataset.endTime),
            }}
          />
        ) : null}
      </Toolbar>
      <PanelGroup direction="vertical">
        {showChart ? (
          <>
            <Panel defaultSize={20} collapsible order={1}>
              <Suspense fallback={<Loading />}>
                {referenceDataset ? (
                  <EuclideanDistanceTimeSeries
                    embeddingDimensionId={embeddingDimensionId}
                  />
                ) : (
                  <CountTimeSeries
                    embeddingDimensionId={embeddingDimensionId}
                  />
                )}
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
  );
}

function umapDataEntryToThreeDimensionalPointItem(
  umapData: UMAPPointsEntry
): ThreeDimensionalPointItem {
  const { id, eventId, coordinates, eventMetadata, embeddingMetadata } =
    umapData;
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
      eventId,
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

  const eventIdToDataMap = useMemo(() => {
    const map = new Map<string, UMAPPointsEntry>();
    allSourceData.forEach((entry) => {
      map.set(entry.eventId, entry);
    });
    return map;
  }, [allSourceData]);

  // Keep the data in the view in-sync with the data in the context
  const setPoints = usePointCloudContext((state) => state.setPoints);
  useEffect(() => {
    setPoints(allSourceData);
  }, [allSourceData, setPoints]);

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
                <TabPane name="Hyperparameters">
                  <UMAPParameterSettings />
                  <HDBSCANParameterSettings />
                </TabPane>
              </Tabs>
            </Panel>
          </PanelGroup>
        </Panel>
        <PanelResizeHandle css={compactResizeHandleCSS} />
        <Panel>
          <div
            css={css`
              position: relative;
              width: 100%;
              height: 100%;
            `}
          >
            <SelectionPanel eventIdToDataMap={eventIdToDataMap} />
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
  eventIdToDataMap: Map<string, UMAPPointsEntry>;
}) {
  const selectedEventIds = usePointCloudContext(
    (state) => state.selectedEventIds
  );

  if (selectedEventIds.size === 0) {
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
                eventIdToDataMap={props.eventIdToDataMap}
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
  const setSelectedEventIds = usePointCloudContext(
    (state) => state.setSelectedEventIds
  );
  const setHighlightedClusterId = usePointCloudContext(
    (state) => state.setHighlightedClusterId
  );

  return (
    <Tabs>
      <TabPane name="Clusters" extra={<Counter>{clusters.length}</Counter>}>
        <ul
          css={(theme) => css`
            flex: 1 1 auto;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: ${theme.spacing.margin8}px;
            margin: ${theme.spacing.margin8}px;
          `}
        >
          {clusters.map((cluster) => {
            return (
              <li key={cluster.id}>
                <ClusterItem
                  clusterId={cluster.id}
                  numPoints={cluster.eventIds.length}
                  isSelected={selectedClusterId === cluster.id}
                  driftRatio={cluster.driftRatio}
                  onClick={() => {
                    if (selectedClusterId !== cluster.id) {
                      setSelectedClusterId(cluster.id);
                      setSelectedEventIds(new Set(cluster.eventIds));
                    } else {
                      setSelectedClusterId(null);
                      setSelectedEventIds(new Set());
                    }
                  }}
                  onMouseEnter={() => {
                    setHighlightedClusterId(cluster.id);
                  }}
                  onMouseLeave={() => {
                    setHighlightedClusterId(null);
                  }}
                />
              </li>
            );
          })}
        </ul>
      </TabPane>
      <TabPane name="Configuration">
        <ClusteringSettings />
      </TabPane>
    </Tabs>
  );
}

function PointCloudNotifications() {
  const { notifyError } = useGlobalNotification();
  const errorMessage = usePointCloudContext((state) => state.errorMessage);
  const setErrorMessage = usePointCloudContext(
    (state) => state.setErrorMessage
  );

  useEffect(() => {
    if (errorMessage !== null) {
      notifyError({
        title: "An error occurred",
        message: errorMessage,
        action: {
          text: "Dismiss",
          onClick: () => {
            setErrorMessage(null);
          },
        },
      });
    }
  }, [errorMessage, notifyError, setErrorMessage]);

  return null;
}
