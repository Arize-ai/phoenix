import React from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { css } from "@emotion/react";

import {
  Accordion,
  AccordionItem,
  TabbedCard,
  TabPane,
  Tabs,
} from "@arizeai/components";

import {
  PrimaryDatasetTimeRange,
  ReferenceDatasetTimeRange,
  Toolbar,
} from "@phoenix/components/filter";
import {
  ModelEmbeddingsTable,
  ModelSchemaTable,
} from "@phoenix/components/model";
import { useDatasets, useTimeRange } from "@phoenix/contexts";

import { HomeQuery } from "./__generated__/HomeQuery.graphql";

type HomePageProps = Readonly<object>;

export function Home(_props: HomePageProps) {
  const { referenceDataset } = useDatasets();
  const { timeRange } = useTimeRange();
  const data = useLazyLoadQuery<HomeQuery>(
    graphql`
      query HomeQuery($startTime: DateTime!, $endTime: DateTime!) {
        ...ModelSchemaTable_dimensions
          @arguments(startTime: $startTime, endTime: $endTime)
        ...ModelEmbeddingsTable_embeddingDimensions
          @arguments(startTime: $startTime, endTime: $endTime)
      }
    `,
    {
      startTime: timeRange.start.toISOString(),
      endTime: timeRange.end.toISOString(),
    }
  );
  return (
    <main>
      <Toolbar>
        <PrimaryDatasetTimeRange />
        {referenceDataset ? (
          <ReferenceDatasetTimeRange
            datasetRole="reference"
            timeRange={{
              start: new Date(referenceDataset.startTime),
              end: new Date(referenceDataset.endTime),
            }}
          />
        ) : null}
      </Toolbar>
      <section
        css={css`
          margin: var(--px-spacing-lg);
        `}
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
            <TabPane name="Dimensions" key="dimensions">
              <ModelSchemaTable model={data} />
            </TabPane>
          </Tabs>
        </TabbedCard>
      </section>
    </main>
  );
}
