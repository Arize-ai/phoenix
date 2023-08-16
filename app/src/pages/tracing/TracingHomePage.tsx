import React, { Suspense } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { Outlet } from "react-router";
import { css } from "@emotion/react";

import { Alert, TabPane, Tabs, View } from "@arizeai/components";

import { TracingHomePageQuery } from "./__generated__/TracingHomePageQuery.graphql";
import { SpansTable } from "./SpansTable";

export function TracingHomePage() {
  const data = useLazyLoadQuery<TracingHomePageQuery>(
    graphql`
      query TracingHomePageQuery {
        ...SpansTable_spans
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

        .ac-alert {
          flex: none;
        }
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
            div[role="tabpanel"] {
              flex: 1 1 auto;
              display: flex;
              flex-direction: column;
              overflow: hidden;
            }
          }
        }
      `}
    >
      <Alert variant="warning" banner>
        Tracing is under construction
      </Alert>
      <Tabs>
        <TabPane name="Spans" title="Spans">
          <Suspense>
            <SpansTable query={data} />
          </Suspense>
        </TabPane>
        <TabPane name="Traces" title="Traces" hidden>
          <View height="100%"></View>
        </TabPane>
      </Tabs>
      <Outlet />
    </main>
  );
}
