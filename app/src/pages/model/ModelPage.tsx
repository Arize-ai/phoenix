import React from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { Outlet } from "react-router";
import { css } from "@emotion/react";

import { TabbedCard, TabPane, Tabs } from "@arizeai/components";

import {
  Disclosure,
  DisclosureGroup,
  DisclosurePanel,
  DisclosureTrigger,
} from "@phoenix/components";
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
          margin: var(--ac-global-dimension-static-size-200);
        `}
      >
        <TabbedCard
          title="Model Schema"
          variant="compact"
          bodyStyle={{ padding: 0 }}
        >
          <Tabs>
            <TabPane name="All" key="all">
              <DisclosureGroup
                defaultExpandedKeys={["embeddings", "dimensions"]}
              >
                <Disclosure id="embeddings">
                  <DisclosureTrigger>Embeddings</DisclosureTrigger>
                  <DisclosurePanel>
                    <ModelEmbeddingsTable model={data} />
                  </DisclosurePanel>
                </Disclosure>
                <Disclosure id="dimensions">
                  <DisclosureTrigger>Dimensions</DisclosureTrigger>
                  <DisclosurePanel>
                    <ModelSchemaTable model={data} />
                  </DisclosurePanel>
                </Disclosure>
              </DisclosureGroup>
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
