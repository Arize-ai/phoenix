import React, { Suspense } from "react";
import { Outlet, useLoaderData } from "react-router";
import { css } from "@emotion/react";

import {
  ActionMenu,
  Flex,
  Icon,
  Icons,
  Item,
  Text,
  View,
} from "@arizeai/components";

import { Loading } from "@phoenix/components";
import { DatasetProvider } from "@phoenix/contexts/DatasetContext";

import type { datasetLoaderQuery$data } from "./__generated__/datasetLoaderQuery.graphql";
import { DatasetExamplesTable } from "./DatasetExamplesTable";
import { LatestVersionLabel } from "./LatestVersionLabel";

export function DatasetPage() {
  const loaderData = useLoaderData() as datasetLoaderQuery$data;
  const latestVersion = loaderData.dataset.latestVersions?.edges[0].version;

  if (!latestVersion) {
    throw new Error("No latest version found for dataset");
  }
  return (
    <DatasetProvider latestVersion={latestVersion}>
      <Suspense fallback={<Loading />}>
        <DatasetPageContent dataset={loaderData["dataset"]} />
      </Suspense>
    </DatasetProvider>
  );
}

function DatasetPageContent({
  dataset,
}: {
  dataset: datasetLoaderQuery$data["dataset"];
}) {
  return (
    <div
      css={css`
        display: flex;
        flex-direction: column;
        flex: 1 1 auto;
        overflow: hidden;
      `}
    >
      <View
        padding="size-200"
        borderBottomWidth="thin"
        borderBottomColor="dark"
        flex="none"
      >
        <Flex
          direction="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Flex direction="column" justifyContent="space-between">
            <Flex direction="row" gap="size-100" alignItems="center">
              <Text elementType="h1" textSize="xlarge" weight="heavy">
                {dataset.name}
              </Text>
              <LatestVersionLabel />
            </Flex>
            <Text color="text-700">{dataset.description || "--"}</Text>
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
          </Flex>
        </Flex>
      </View>
      <DatasetExamplesTable dataset={dataset} />
      <Suspense>
        <Outlet />
      </Suspense>
    </div>
  );
}
