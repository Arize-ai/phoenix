import React, { startTransition, Suspense, useCallback, useState } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { Outlet } from "react-router";
import { css } from "@emotion/react";

import { TabPane, Tabs } from "@arizeai/components";

import { TracingHomePageQuery } from "./__generated__/TracingHomePageQuery.graphql";
import { SpansTable } from "./SpansTable";
import { StreamToggle } from "./StreamToggle";
import { TracesTable } from "./TracesTable";
import { TracingHomePageHeader } from "./TracingHomePageHeader";

/**
 * Sets the refetch key to trigger a refetch
 */
const useRefetch = (): [number, () => void] => {
  const [fetchKey, setFetchKey] = useState<number>(0);
  const refetch = useCallback(() => {
    startTransition(() => {
      setFetchKey((prev) => prev + 1);
    });
  }, [setFetchKey]);
  return [fetchKey, refetch];
};

export function TracingHomePage() {
  const [fetchKey, refetch] = useRefetch();
  const data = useLazyLoadQuery<TracingHomePageQuery>(
    graphql`
      query TracingHomePageQuery {
        ...SpansTable_spans
        ...TracesTable_spans
        ...TracingHomePageHeader_stats
        ...StreamToggle_data
      }
    `,
    {},
    {
      fetchKey,
      fetchPolicy: "store-and-network",
    }
  );
  return (
    <main
      css={css`
        flex: 1 1 auto;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        .ac-tabs {
          flex: 1 1 auto;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          .ac-tabs__pane-container {
            flex: 1 1 auto;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            div[role="tabpanel"]:not([hidden]) {
              flex: 1 1 auto;
              display: flex;
              flex-direction: column;
              overflow: hidden;
            }
          }
        }
      `}
    >
      <TracingHomePageHeader
        query={data}
        extra={<StreamToggle query={data} onRefresh={() => refetch()} />}
      />
      <Tabs>
        <TabPane name="Traces">
          {({ isSelected }) => {
            return (
              isSelected && (
                <Suspense>
                  <TracesTable query={data} />
                </Suspense>
              )
            );
          }}
        </TabPane>
        <TabPane name="Spans" title="Spans">
          {({ isSelected }) => {
            return (
              isSelected && (
                <Suspense>
                  <SpansTable query={data} />
                </Suspense>
              )
            );
          }}
        </TabPane>
      </Tabs>
      <Suspense>
        <Outlet />
      </Suspense>
    </main>
  );
}
