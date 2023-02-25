import React, { Suspense, useEffect, useMemo, useState } from "react";
import {
  graphql,
  PreloadedQuery,
  useLazyLoadQuery,
  usePreloadedQuery,
  useQueryLoader,
} from "react-relay";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { Column } from "react-table";
import { subDays } from "date-fns";
import { css } from "@emotion/react";

import { Switch, TabPane, Tabs } from "@arizeai/components";

import { Loading, LoadingMask } from "@phoenix/components";
import {
  ColoringStrategy,
  PointCloud,
  PointCloudProvider,
  ThreeDimensionalPointItem,
  usePointCloud,
} from "@phoenix/components/canvas";
import { PointCloudDisplaySettings } from "@phoenix/components/canvas/PointCloudDisplaySettings";
import { ClusterItem } from "@phoenix/components/cluster";
import {
  PrimaryDatasetTimeRange,
  ReferenceDatasetTimeRange,
  Toolbar,
} from "@phoenix/components/filter";
import { resizeHandleCSS } from "@phoenix/components/resize/styles";
import { Table } from "@phoenix/components/table";
import { useDatasets } from "@phoenix/contexts";
import {
  TimeSliceContextProvider,
  useTimeSlice,
} from "@phoenix/contexts/TimeSliceContext";
import { useEmbeddingDimensionId } from "@phoenix/hooks";

import { EmbeddingSelectionPanelContentQuery } from "./__generated__/EmbeddingSelectionPanelContentQuery.graphql";
import {
  EmbeddingUMAPQuery as UMAPQueryType,
  EmbeddingUMAPQuery$data,
} from "./__generated__/EmbeddingUMAPQuery.graphql";
import { EuclideanDistanceTimeSeries } from "./EuclideanDistanceTimeSeries";

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
    loadQuery({
      id: embeddingDimensionId,
      timeRange,
    });
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
            <PointCloudProvider>
              <Suspense fallback={<LoadingMask />}>
                {queryReference ? (
                  <PointCloudDisplay queryReference={queryReference} />
                ) : null}
              </Suspense>
            </PointCloudProvider>
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
  const [coloringStrategy, setColoringStrategy] = useState<ColoringStrategy>(
    ColoringStrategy.dataset
  );

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
                  <PointCloudDisplaySettings
                    coloringStrategy={coloringStrategy}
                    onColoringStrategyChange={setColoringStrategy}
                  />
                </TabPane>
                <TabPane name="Parameters">Parameters</TabPane>
              </Tabs>
            </Panel>
          </PanelGroup>
        </Panel>
        <PanelResizeHandle css={resizeHandleCSS} />
        <Panel>
          <PanelGroup autoSaveId="embedding-main" direction="vertical">
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
                coloringStrategy={coloringStrategy}
              />
            </Panel>

            <PanelResizeHandle css={resizeHandleCSS} />
            <Panel
              id="embedding-point-selection"
              defaultSize={20}
              collapsible
              order={2}
            >
              <Suspense fallback={"Loading..."}>
                <SelectionPanelContent />
              </Suspense>
            </Panel>
          </PanelGroup>
        </Panel>
      </PanelGroup>
    </div>
  );
};

function ClustersPanelContents({
  clusters,
}: {
  clusters: readonly UMAPClusterEntry[];
}) {
  const { selectedClusterId, setSelectedClusterId } = usePointCloud();
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

function SelectionPanelContent() {
  const { selectedPointIds } = usePointCloud();
  const { primaryEventIds, referenceEventIds } = useMemo(() => {
    const primaryEventIds: string[] = [];
    const referenceEventIds: string[] = [];
    selectedPointIds.forEach((id) => {
      if (id.includes("PRIMARY")) {
        primaryEventIds.push(id);
      } else {
        referenceEventIds.push(id);
      }
    });
    return { primaryEventIds, referenceEventIds };
  }, [selectedPointIds]);
  const data = useLazyLoadQuery<EmbeddingSelectionPanelContentQuery>(
    graphql`
      query EmbeddingSelectionPanelContentQuery(
        $primaryEventIds: [ID!]!
        $referenceEventIds: [ID!]!
      ) {
        model {
          primaryDataset {
            events(eventIds: $primaryEventIds) {
              dimensions {
                dimension {
                  name
                  type
                }
                value
              }
              eventMetadata {
                predictionLabel
                actualLabel
              }
            }
          }
          referenceDataset {
            events(eventIds: $referenceEventIds) {
              dimensions {
                dimension {
                  name
                  type
                }
                value
              }
              eventMetadata {
                predictionLabel
                actualLabel
              }
            }
          }
        }
      }
    `,
    {
      primaryEventIds: [...primaryEventIds],
      referenceEventIds: [...referenceEventIds],
    }
  );

  const allEvents = useMemo(() => {
    const primaryEvents = data.model?.primaryDataset?.events ?? [];
    const referenceEvents = data.model?.referenceDataset?.events ?? [];
    return [...primaryEvents, ...referenceEvents];
  }, [data]);

  const tableData = useMemo(() => {
    return allEvents.map((event) => {
      return {
        actualLabel: event.eventMetadata?.actualLabel,
        predictionLabel: event.eventMetadata?.predictionLabel,
      };
    });
  }, [allEvents]);

  const columns: Column<typeof tableData[number]>[] = [
    {
      Header: "Actual Label",
      accessor: "actualLabel",
    },
    {
      Header: "Prediction Label",
      accessor: "predictionLabel",
    },
  ];

  return (
    // @ts-expect-error add more tabs
    <Tabs>
      <TabPane name="Selection">
        <Table columns={columns} data={tableData} />
      </TabPane>
    </Tabs>
  );
}
