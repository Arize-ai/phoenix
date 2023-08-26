import React, { Suspense } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { Outlet } from "react-router";
import { css } from "@emotion/react";

import { TabPane, Tabs } from "@arizeai/components";

import { TracingHomePageQuery } from "./__generated__/TracingHomePageQuery.graphql";
import { SpansTable } from "./SpansTable";
import { TracesTable } from "./TracesTable";
import { TracingHomePageHeader } from "./TracingHomePageHeader";

export function TracingHomePage() {
  const data = useLazyLoadQuery<TracingHomePageQuery>(
    graphql`
      query TracingHomePageQuery {
        ...SpansTable_spans
        ...TracesTable_spans
        ...TracingHomePageHeader_stats
      }
    `,
    {}
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
      <TracingHomePageHeader query={data} />
      <Tabs>
        <TabPane name="Traces" title="Traces">
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
