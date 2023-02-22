import React, { Suspense, useEffect, useState } from "react";
import {
  PreloadedQuery,
  fetchQuery,
  graphql,
  useLazyLoadQuery,
  usePreloadedQuery,
  useQueryLoader,
} from "react-relay";
import { LoaderFunctionArgs } from "react-router";
import RelayEnvironment from "../RelayEnvironment";
import { EmbeddingLoaderQuery } from "./__generated__/EmbeddingLoaderQuery.graphql";
import { css } from "@emotion/react";
import {
  ColoringStrategy,
  PointCloud,
  PointCloudProvider,
  ThreeDimensionalPointItem,
  usePointCloud,
} from "../components/canvas";
import { resizeHandleCSS } from "../components/resize/styles";
import {
  EmbeddingUMAPQuery$data,
  EmbeddingUMAPQuery as UMAPQueryType,
} from "./__generated__/EmbeddingUMAPQuery.graphql";
import { useEmbeddingDimensionId } from "../hooks";
import { LoadingMask } from "../components";
import { ClusterItem } from "../components/cluster";
import { Tabs, TabPane, Switch } from "@arizeai/components";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { Toolbar } from "../components/filter";
import { PointCloudDisplaySettings } from "../components/canvas/PointCloudDisplaySettings";
import { useDatasets } from "../contexts";
import { EuclideanDistanceTimeSeries } from "../components/chart/EuclideanDistanceTimeSeries";

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
  const embeddingDimensionId = useEmbeddingDimensionId();
  const { primaryDataset } = useDatasets();
  const [showDriftChart, setShowDriftChart] = useState<boolean>(true);
  const [queryReference, loadQuery] =
    useQueryLoader<UMAPQueryType>(EmbeddingUMAPQuery);

  // Load the query on first render
  useEffect(() => {
    loadQuery({
      id: embeddingDimensionId,
      timeRange: {
        start: primaryDataset.startTime,
        end: primaryDataset.endTime,
      },
    });
  }, []);

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
          <Switch
            onChange={(isSelected) => {
              setShowDriftChart(isSelected);
            }}
            labelPlacement="start"
          >
            Show Drift Chart
          </Switch>
        }
      ></Toolbar>
      <PanelGroup direction="vertical">
        {showDriftChart ? (
          <>
            <Panel defaultSize={15} collapsible order={1}>
              <div
                css={css`
                  flex: 1 1 auto;
                  width: 100%;
                  height: 100%;
                  position: relative;
                `}
              >
                <Suspense fallback={<LoadingMask />}>
                  <EuclideanDistanceTimeSeries
                    embeddingDimensionId={embeddingDimensionId}
                    timeRange={{
                      start: new Date(primaryDataset.startTime),
                      end: new Date(primaryDataset.endTime),
                    }}
                  />
                </Suspense>
              </div>
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
                <PointCloudProvider>
                  <PointCloudDisplay queryReference={queryReference} />
                </PointCloudProvider>
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
  const { selectedPointIds } = usePointCloud();
  const [selectedClusterId, setSelectedClusterId] = React.useState<
    string | null
  >(null);
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
              <ClustersPanelContents
                selectedClusterId={selectedClusterId}
                setSelectedClusterId={setSelectedClusterId}
                clusters={clusters}
              />
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
                selectedClusterId={selectedClusterId}
                coloringStrategy={coloringStrategy}
              />
            </Panel>
            {selectedPointIds.size ? (
              <>
                <PanelResizeHandle css={resizeHandleCSS} />
                <Panel
                  id="embedding-point-selection"
                  defaultSize={20}
                  collapsible
                  order={2}
                >
                  <Suspense fallback={"Loading..."}>
                    <SelectionPanelContent
                      selectedPointIds={selectedPointIds}
                    />
                  </Suspense>
                </Panel>
              </>
            ) : null}
          </PanelGroup>
        </Panel>
      </PanelGroup>
    </div>
  );
};

function ClustersPanelContents({
  clusters,
  selectedClusterId,
  setSelectedClusterId,
}: {
  setSelectedClusterId: (id: string | null) => void;
  selectedClusterId: string | null;
  clusters: readonly UMAPClusterEntry[];
}) {
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

function SelectionPanelContent({
  selectedPointIds,
}: {
  selectedPointIds: Set<string>;
}) {
  const data = useLazyLoadQuery(
    graphql`
      query EmbeddingSelectionPanelContentQuery($eventIds: [ID!]!) {
        model {
          primaryDataset {
            events(eventIds: $eventIds) {
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
    { eventIds: [...selectedPointIds] }
  );
  return (
    // @ts-expect-error add more tabs
    <Tabs>
      <TabPane name="Selection">{JSON.stringify(data)}</TabPane>
    </Tabs>
  );
}

/**
 * Loads in the necessary page data, e.g. info about the embedding
 */
export async function embeddingLoader(args: LoaderFunctionArgs) {
  const { embeddingDimensionId } = args.params;
  return fetchQuery<EmbeddingLoaderQuery>(
    RelayEnvironment,
    graphql`
      query EmbeddingLoaderQuery($id: GlobalID!) {
        embedding: node(id: $id) {
          ... on EmbeddingDimension {
            id
            name
          }
        }
      }
    `,
    {
      id: embeddingDimensionId as string,
    }
  ).toPromise();
}
