import React from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { Outlet } from "react-router";
import { css } from "@emotion/react";

import {
  Accordion,
  AccordionItem,
  TabbedCard,
  TabPane,
  Tabs,
} from "@arizeai/components";

import {
  PrimaryInferencesTimeRange,
  ReferenceInferencesTimeRange,
  Toolbar,
} from "@phoenix/components/filter";
import {
  ModelEmbeddingsTable,
  ModelSchemaTable,
} from "@phoenix/components/model";
import { useInferences, useTimeRange } from "@phoenix/contexts";

import { ModelPageQuery } from "./__generated__/ModelPageQuery.graphql";

type ModelPageProps = Readonly<object>;

export function ModelPage(_props: ModelPageProps) {
  const { referenceInferences } = useInferences();
  const { timeRange } = useTimeRange();
  const data = useLazyLoadQuery<ModelPageQuery>(
    graphql`
      query ModelPageQuery($startTime: DateTime!, $endTime: DateTime!) {
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
        <PrimaryInferencesTimeRange />
        {referenceInferences ? (
          <ReferenceInferencesTimeRange
            inferencesRole="reference"
            timeRange={{
              start: new Date(referenceInferences.startTime),
              end: new Date(referenceInferences.endTime),
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
              <Accordion>
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
      <Outlet />
    </main>
  );
}
