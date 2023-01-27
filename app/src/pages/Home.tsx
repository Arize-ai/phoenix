import { css } from "@emotion/react";
import {
  TabbedCard,
  Tabs,
  TabPane,
  Breadcrumbs,
  Item,
} from "@arizeai/components";
import { ModelSchemaTable, ModelEmbeddingsTable } from "../components/model";
import React from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { HomeQuery } from "./__generated__/HomeQuery.graphql";

type HomePageProps = Readonly<object>;

export function Home(_props: HomePageProps) {
  const data = useLazyLoadQuery<HomeQuery>(
    graphql`
      query HomeQuery {
        ...ModelSchemaTable_dimensions
        ...ModelEmbeddingsTable_embeddingDimensions
      }
    `,
    {}
  );
  return (
    <main
      css={(theme) =>
        css`
          margin: ${theme.spacing.margin8}px;
          nav {
            margin-bottom: ${theme.spacing.margin8}px;
          }
        `
      }
    >
      <Breadcrumbs>
        <Item key="model">Model</Item>
        <Item key="overview">Overview</Item>
      </Breadcrumbs>
      <TabbedCard
        title="Model Schema"
        variant="compact"
        bodyStyle={{
          padding: 0,
        }}
      >
        <Tabs>
          <TabPane name="Dimensions">
            <ModelSchemaTable model={data} />
          </TabPane>
          <TabPane name="Embeddings">
            <ModelEmbeddingsTable model={data} />
          </TabPane>
        </Tabs>
      </TabbedCard>
    </main>
  );
}
