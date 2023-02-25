import { fetchQuery, graphql } from "react-relay";
import { LoaderFunctionArgs } from "react-router";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import { embeddingLoaderQuery } from "./__generated__/embeddingLoaderQuery.graphql";

/**
 * Loads in the necessary page data, e.g. info about the embedding
 */
export async function embeddingLoader(args: LoaderFunctionArgs) {
  const { embeddingDimensionId } = args.params;
  return fetchQuery<embeddingLoaderQuery>(
    RelayEnvironment,
    graphql`
      query embeddingLoaderQuery($id: GlobalID!) {
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
