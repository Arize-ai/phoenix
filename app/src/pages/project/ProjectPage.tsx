import React, { Suspense } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { Outlet } from "react-router";
import { css } from "@emotion/react";

import { TabPane, Tabs } from "@arizeai/components";

import { ProjectPageQuery } from "./__generated__/ProjectPageQuery.graphql";
import { ProjectPageHeader } from "./ProjectPageHeader";
import { SpansTable } from "./SpansTable";
import { StreamToggle } from "./StreamToggle";
import { TracesTable } from "./TracesTable";

const mainCSS = css`
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
`;

export function ProjectPage() {
  const data = useLazyLoadQuery<ProjectPageQuery>(
    graphql`
      query ProjectPageQuery {
        ...SpansTable_spans
        ...TracesTable_spans
        ...ProjectPageHeader_stats
        ...StreamToggle_data
      }
    `,
    {},
    {
      fetchPolicy: "store-and-network",
    }
  );
  return (
    <main css={mainCSS}>
      <ProjectPageHeader query={data} extra={<StreamToggle query={data} />} />
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
