import React from "react";
import { fetchQuery, graphql } from "react-relay";
import { LoaderFunctionArgs, useLoaderData, useNavigate } from "react-router";
import RelayEnvironment from "../RelayEnvironment";
import {
  EmbeddingLoaderQuery,
  EmbeddingLoaderQuery$data,
} from "./__generated__/EmbeddingLoaderQuery.graphql";
import { Breadcrumbs, Item } from "@arizeai/components";
import { css } from "@emotion/react";

export function Embedding() {
  const navigate = useNavigate();
  const data = useLoaderData() as EmbeddingLoaderQuery$data;
  return (
    <main
      css={(theme) => css`
        nav {
          margin: ${theme.spacing.margin8}px;
        }
      `}
    >
      <Breadcrumbs
        onAction={(action) => {
          if (action === "model") {
            navigate("/");
          }
        }}
      >
        <Item key="model">Model</Item>
        <Item>Embeddings</Item>
        <Item>{data.embedding.name}</Item>
      </Breadcrumbs>
    </main>
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
