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
import { DriftPointCloud } from "../components/canvas";
import { data as primaryData } from "../data/umapData";

export function Embedding() {
  const navigate = useNavigate();
  const data = useLoaderData() as EmbeddingLoaderQuery$data;
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
      <div
        css={css`
          width: 100%;
          height: 100%;
          position: relative;
        `}
      >
        <DriftPointCloud primaryData={primaryData as any} referenceData={[]} />
      </div>
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
