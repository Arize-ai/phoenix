import { css } from "@emotion/react";
import { TabbedCard, Tabs, TabPane } from "@arizeai/components";
import { ModelSchemaTable, ModelEmbeddingsTable } from "../components/model";
import React from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { HomeQuery } from "./__generated__/HomeQuery.graphql";
import { Toolbar } from "../components/filter";

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
    <main>
      <Toolbar />
      <section
        css={(theme) =>
          css`
            margin: ${theme.spacing.margin8}px;
          `
        }
      >
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
      </section>
    </main>
  );
}
