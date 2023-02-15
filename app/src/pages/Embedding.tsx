import React, { Suspense, useEffect } from "react";
import {
  PreloadedQuery,
  fetchQuery,
  graphql,
  usePreloadedQuery,
  useQueryLoader,
} from "react-relay";
import { LoaderFunctionArgs } from "react-router";
import RelayEnvironment from "../RelayEnvironment";
import { EmbeddingLoaderQuery } from "./__generated__/EmbeddingLoaderQuery.graphql";
import { css } from "@emotion/react";
import { PointCloud, ThreeDimensionalPointItem } from "../components/canvas";
import {
  EmbeddingUMAPQuery$data,
  EmbeddingUMAPQuery as UMAPQueryType,
} from "./__generated__/EmbeddingUMAPQuery.graphql";
import { useEmbeddingDimensionId } from "../hooks";
import { LoadingMask } from "../components";
import { ClusterItem } from "../components/cluster";
import { Tabs, TabPane } from "@arizeai/components";

type UMAPPointsEntry = NonNullable<
  EmbeddingUMAPQuery$data["embedding"]["UMAPPoints"]
>["data"][number];

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
  const [queryReference, loadQuery] =
    useQueryLoader<UMAPQueryType>(EmbeddingUMAPQuery);

  // Load the query on first render
  useEffect(() => {
    loadQuery({
      id: embeddingDimensionId,
      timeRange: {
        start: new Date().toISOString(),
        end: new Date().toISOString(),
      },
    });
  }, []);
  return (
    <main
      css={(theme) => css`
        height: 100%;
        nav {
          margin: ${theme.spacing.margin8}px;
          display: flex;
          flex-direction: column;
        }
      `}
    >
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
  const [selectedClusterId, setSelectedClusterId] = React.useState<
    string | null
  >(null);

  return (
    <div
      css={css`
        display: flex;
        flex-direction: row;
        align-items: stretch;
        width: 100%;
        height: 100%;
      `}
    >
      <section
        css={(theme) => css`
          flex: none;
          width: 300px;
          background-color: ${theme.colors.gray900};
        `}
      >
        {/* @ts-expect-error only render 1 tab for now */}
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
      </section>

      <PointCloud
        primaryData={
          sourceData.map(umapDataEntryToThreeDimensionalPointItem) ?? []
        }
        referenceData={
          referenceSourceData
            ? referenceSourceData.map(umapDataEntryToThreeDimensionalPointItem)
            : null
        }
        clusters={clusters}
        selectedClusterId={selectedClusterId}
      />
    </div>
  );
};

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
