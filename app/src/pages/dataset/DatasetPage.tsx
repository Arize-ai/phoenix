import React, { Suspense, useMemo } from "react";
import { Outlet, useLoaderData } from "react-router";
import { css } from "@emotion/react";

import {
  ActionMenu,
  Flex,
  Icon,
  Icons,
  Item,
  TabPane,
  Tabs,
  Text,
  View,
} from "@arizeai/components";

import { Loading } from "@phoenix/components";
import { useNotifySuccess } from "@phoenix/contexts";
import {
  DatasetProvider,
  useDatasetContext,
} from "@phoenix/contexts/DatasetContext";

import type { datasetLoaderQuery$data } from "./__generated__/datasetLoaderQuery.graphql";
import { AddDatasetExampleButton } from "./AddDatasetExampleButton";
import { DatasetCodeDropdown } from "./DatasetCodeDropdown";
import { DatasetExamplesTable } from "./DatasetExamplesTable";
import { DatasetExperimentsTable } from "./DatasetExperimentsTable";
import { DatasetHistoryButton } from "./DatasetHistoryButton";

export function DatasetPage() {
  const loaderData = useLoaderData() as datasetLoaderQuery$data;
  const latestVersion = useMemo(() => {
    const versions = loaderData.dataset.latestVersions;
    if (versions?.edges && versions.edges.length) {
      return versions.edges[0].version;
    }
    return null;
  }, [loaderData]);

  return (
    <DatasetProvider
      datasetId={loaderData.dataset.id}
      latestVersion={latestVersion}
    >
      <Suspense fallback={<Loading />}>
        <DatasetPageContent dataset={loaderData["dataset"]} />
      </Suspense>
    </DatasetProvider>
  );
}

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
    div[role="tablist"] {
      flex: none;
    }
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

function DatasetPageContent({
  dataset,
}: {
  dataset: datasetLoaderQuery$data["dataset"];
}) {
  const refreshLatestVersion = useDatasetContext(
    (state) => state.refreshLatestVersion
  );
  const notifySuccess = useNotifySuccess();
  return (
    <main css={mainCSS}>
      <View
        paddingStart="size-200"
        paddingEnd="size-200"
        paddingTop="size-200"
        paddingBottom="size-50"
        flex="none"
      >
        <Flex
          direction="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Flex direction="column" justifyContent="space-between">
            <Flex direction="row" gap="size-200" alignItems="center">
              {/* TODO(datasets): Add an icon here to make the UI cohesive */}
              {/* <Icon svg={<Icons.DatabaseOutline />} /> */}
              <Flex direction="column">
                <Text elementType="h1" textSize="xlarge" weight="heavy">
                  {dataset.name}
                </Text>
                <Text color="text-700">{dataset.description || "--"}</Text>
              </Flex>
            </Flex>
          </Flex>
          <Flex direction="row" gap="size-100">
            <ActionMenu
              align="end"
              icon={<Icon svg={<Icons.DownloadOutline />} />}
              onAction={(action) => {
                switch (action) {
                  case "csv":
                    window.open(`/v1/datasets/${dataset.id}/csv`, "_blank");
                    break;
                }
              }}
            >
              <Item key="csv">Download CSV</Item>
            </ActionMenu>
            <DatasetHistoryButton datasetId={dataset.id} />
            <DatasetCodeDropdown />
            <AddDatasetExampleButton
              datasetId={dataset.id}
              onAddExampleCompleted={() => {
                notifySuccess({
                  title: "Example added",
                  message:
                    "The example has been added successfully and the version has been updated.",
                });
                refreshLatestVersion();
              }}
            />
          </Flex>
        </Flex>
      </View>
      <Tabs>
        <TabPane name="Experiments">
          <DatasetExperimentsTable dataset={dataset} />
        </TabPane>
        <TabPane name="Examples">
          <DatasetExamplesTable dataset={dataset} />
        </TabPane>
      </Tabs>
      <Suspense>
        <Outlet />
      </Suspense>
    </main>
  );
}
