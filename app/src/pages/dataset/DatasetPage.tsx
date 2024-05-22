import React, { Suspense, useMemo } from "react";
import { graphql, useRefetchableFragment } from "react-relay";
import { useLoaderData } from "react-router";

import { Flex, Text, View } from "@arizeai/components";

import { Loading } from "@phoenix/components";

import type {
  datasetLoaderQuery,
  datasetLoaderQuery$data,
} from "./__generated__/datasetLoaderQuery.graphql";
import type { DatasetPageExamplesFragment$key } from "./__generated__/DatasetPageExamplesFragment.graphql";

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
  const [data] = useRefetchableFragment<
    datasetLoaderQuery,
    DatasetPageExamplesFragment$key
  >(
    graphql`
      fragment DatasetPageExamplesFragment on Dataset
      @refetchable(queryName: "DatasetPageExamplesQuery") {
        examples {
          edges {
            node {
              id
              input
              output
              metadata
            }
          }
        }
      }
    `,
    dataset
  );
  const examples = useMemo(
    () => data.examples.edges.map((edge) => edge.node),
    [data]
  );
  // eslint-disable-next-line
  console.log({ examples });
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
