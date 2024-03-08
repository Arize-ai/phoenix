import React, { Suspense } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { Outlet } from "react-router";
import { useParams } from "react-router";
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
  const { projectId } = useParams();
  const data = useLazyLoadQuery<ProjectPageQuery>(
    graphql`
      query ProjectPageQuery($id: GlobalID!) {
        project: node(id: $id) {
          ...SpansTable_spans
          ...TracesTable_spans
          ...ProjectPageHeader_stats
          ...StreamToggle_data
        }
      }
    `,
    {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      id: projectId as string,
    },
    {
      fetchPolicy: "store-and-network",
    }
  );
  return (
    <main css={mainCSS}>
      <ProjectPageHeader
        project={data.project}
        extra={<StreamToggle project={data.project} />}
      />
      <Tabs>
        <TabPane name="Traces">
          {({ isSelected }) => {
            return (
              isSelected && (
                <Suspense>
                  <TracesTable project={data.project} />
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
                  <SpansTable project={data.project} />
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
