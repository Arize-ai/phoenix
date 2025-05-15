import { graphql, useLazyLoadQuery } from "react-relay";
import { Outlet } from "react-router";
import { css } from "@emotion/react";

import { TabbedCard } from "@arizeai/components";

import {
  Disclosure,
  DisclosureGroup,
  DisclosurePanel,
  DisclosureTrigger,
  LazyTabPanel,
  Tab,
  TabList,
  Tabs,
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
            <TabList>
              <Tab id="all">All</Tab>
              <Tab id="embeddings">Embeddings</Tab>
              <Tab id="dimensions">Dimensions</Tab>
            </TabList>
            <LazyTabPanel id="all">
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
            </LazyTabPanel>
            <LazyTabPanel id="embeddings">
              <ModelEmbeddingsTable model={data} />
            </LazyTabPanel>
            <LazyTabPanel id="dimensions">
              <ModelSchemaTable model={data} />
            </LazyTabPanel>
          </Tabs>
        </TabbedCard>
      </section>
      <Outlet />
    </main>
  );
}
