import React from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { css } from "@emotion/react";

import {
  Accordion,
  AccordionItem,
  Card,
  TabbedCard,
  TabPane,
  Tabs,
} from "@arizeai/components";

import { Toolbar } from "@phoenix/components/filter";
import {
  ModelEmbeddingsTable,
  ModelSchemaTable,
} from "@phoenix/components/model";
import { useDatasets } from "@phoenix/contexts";

import { HomeQuery } from "./__generated__/HomeQuery.graphql";

type HomePageProps = Readonly<object>;

export function Home(_props: HomePageProps) {
  const { primaryDataset } = useDatasets();
  const data = useLazyLoadQuery<HomeQuery>(
    graphql`
      query HomeQuery($startTime: DateTime!, $endTime: DateTime!) {
        ...ModelSchemaTable_dimensions
        ...ModelEmbeddingsTable_embeddingDimensions
          @arguments(startTime: $startTime, endTime: $endTime)
      }
    `,
    { startTime: primaryDataset.startTime, endTime: primaryDataset.endTime }
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
          bodyStyle={{ padding: 0 }}
        >
          <Tabs>
            <TabPane name="All" key="all">
              <Accordion variant="compact">
                <AccordionItem title="Embeddings" id="embeddings">
                  <ModelEmbeddingsTable model={data} />
                </AccordionItem>
                <AccordionItem title="Dimensions" id="dimensions">
                  <ModelSchemaTable model={data} />
                </AccordionItem>
              </Accordion>
            </TabPane>
            <TabPane name="Embeddings" key="embeddings">
              <ModelEmbeddingsTable model={data} />
            </TabPane>
            <TabPane name="Dimensions" key="embeddings">
              <ModelSchemaTable model={data} />
            </TabPane>
          </Tabs>
        </TabbedCard>
      </section>
    </main>
  );
}
