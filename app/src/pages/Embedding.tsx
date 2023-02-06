import React, { useEffect } from "react";
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

type UMAPPointsEntry = NonNullable<
  EmbeddingUMAPQuery$data["embedding"]["UMAPPoints"]
>["data"][number];

const EmbeddingUMAPQuery = graphql`
  query EmbeddingUMAPQuery($id: GlobalID!, $timeRange: TimeRange!) {
    embedding: node(id: $id) {
      ... on EmbeddingDimension {
        UMAPPoints(timeRange: $timeRange) {
          data {
            coordinates {
              __typename
              ... on Point3D {
                x
                y
                z
              }
            }
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
        {queryReference ? (
          <PointCloudDisplay queryReference={queryReference} />
        ) : null}
      </div>
    </main>
  );
}

function umapDataEntryToThreeDimensionalPointItem(
  umapData: UMAPPointsEntry
): ThreeDimensionalPointItem {
  const { coordinates } = umapData;
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
    metaData: {},
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

  const primaryData =
    data.embedding?.UMAPPoints?.data?.map(
      umapDataEntryToThreeDimensionalPointItem
    ) ?? [];

  return <PointCloud primaryData={primaryData} referenceData={[]} />;
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
