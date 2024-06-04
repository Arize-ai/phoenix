import React, { Suspense, useMemo } from "react";
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
import { DatasetCodeDropdown } from "./DatasetCodeDropdown";
import { DatasetExamplesTable } from "./DatasetExamplesTable";

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
            <DatasetCodeDropdown />
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
