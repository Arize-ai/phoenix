import React, { Suspense } from "react";
import { useLoaderData } from "react-router";

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

import type { datasetLoaderQuery$data } from "./__generated__/datasetLoaderQuery.graphql";
import { DatasetExamplesTable } from "./DatasetExamplesTable";

export function DatasetPage() {
  const loaderData = useLoaderData() as datasetLoaderQuery$data;
  return (
    <Suspense fallback={<Loading />}>
      <DatasetPageContent dataset={loaderData["dataset"]} />
    </Suspense>
  );
}

function DatasetPageContent({
  dataset,
}: {
  dataset: datasetLoaderQuery$data["dataset"];
}) {
  return (
    <div>
      <View
        padding="size-200"
        borderBottomWidth="thin"
        borderBottomColor="dark"
      >
        <Flex
          direction="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Flex direction="column" justifyContent="space-between">
            <Text elementType="h1" textSize="xlarge" weight="heavy">
              {dataset.name}
            </Text>
            <Text color="text-700">{dataset.description || "--"}</Text>
          </Flex>
          <Flex direction="row" gap="size-100">
            <ActionMenu
              icon={<Icon svg={<Icons.DownloadOutline />} />}
              onAction={(action) => {
                switch (action) {
                  case "csv":
                    // TODO(datasets): change this URL to be more RESTful
                    window.open(
                      `/v1/datasets/download/csv/${dataset.id}`,
                      "_blank"
                    );
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
    </div>
  );
}
