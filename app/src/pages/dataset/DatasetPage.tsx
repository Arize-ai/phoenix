import React, { Suspense } from "react";
import { useLoaderData } from "react-router";

import { Flex, Heading, Text, View } from "@arizeai/components";

import { Loading } from "@phoenix/components";

import { datasetLoaderQuery$data } from "./__generated__/datasetLoaderQuery.graphql";

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
        <Flex direction="row" justifyContent="space-between">
          <Flex direction="column" justifyContent="space-between">
            <Text elementType="h1" textSize="xlarge" weight="heavy">
              {dataset.name}
            </Text>
            <Text color="text-700">{dataset.description || "--"}</Text>
          </Flex>
        </Flex>
      </View>
    </div>
  );
}
