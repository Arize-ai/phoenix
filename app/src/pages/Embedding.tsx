import React from "react";
import { fetchQuery, graphql } from "react-relay";
import { LoaderFunctionArgs, useLoaderData } from "react-router";
import RelayEnvironment from "../RelayEnvironment";
import {
  EmbeddingLoaderQuery,
  EmbeddingLoaderQuery$data,
} from "./__generated__/EmbeddingLoaderQuery.graphql";

export function Embedding() {
  const data = useLoaderData() as EmbeddingLoaderQuery$data;
  return (
    <div>
      <h1>{`Embedding: ${data.embedding.name}`}</h1>
    </div>
  );
}

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
