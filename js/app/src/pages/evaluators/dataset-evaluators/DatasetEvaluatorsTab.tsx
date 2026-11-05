import { Suspense } from "react";
import { useLoaderData } from "react-router";
import invariant from "tiny-invariant";

import { Flex, View } from "@phoenix/components";
import { Skeleton } from "@phoenix/components/core/loading";
import { useOwnedPreloadedQuery } from "@phoenix/hooks";
import type { datasetEvaluatorsTabLoaderQuery } from "@phoenix/pages/evaluators/dataset-evaluators/__generated__/datasetEvaluatorsTabLoaderQuery.graphql";
import type { DatasetEvaluatorsTabLoaderType } from "@phoenix/pages/evaluators/dataset-evaluators/datasetEvaluatorsTabLoader";
import { datasetEvaluatorsTabLoaderGql } from "@phoenix/pages/evaluators/dataset-evaluators/datasetEvaluatorsTabLoader";
import { DatasetEvaluatorsTabTable } from "@phoenix/pages/evaluators/dataset-evaluators/DatasetEvaluatorsTabTable";
import { DatasetEvaluatorsFilterBar } from "@phoenix/pages/evaluators/DatasetEvaluatorsFilterBar";
import { DatasetEvaluatorsFilterProvider } from "@phoenix/pages/evaluators/DatasetEvaluatorsFilterProvider";
import { DatasetEvaluatorsTableSkeleton } from "@phoenix/pages/evaluators/DatasetEvaluatorsTable";

/**
 * The Evaluators page's Dataset evaluators tab: every evaluator attached to a
 * dataset, across datasets.
 */
export function DatasetEvaluatorsTab() {
  const loaderData = useLoaderData<DatasetEvaluatorsTabLoaderType>();
  invariant(loaderData, "loaderData is required");
  const query = useOwnedPreloadedQuery<datasetEvaluatorsTabLoaderQuery>({
    query: datasetEvaluatorsTabLoaderGql,
    queryRef: loaderData,
  });
  return (
    <DatasetEvaluatorsFilterProvider>
      <Flex direction="column" height="100%">
        <DatasetEvaluatorsFilterBar
          padding="size-100"
          placeholder="Search evaluators or datasets"
        />
        <Suspense fallback={<DatasetEvaluatorsTableSkeleton />}>
          <DatasetEvaluatorsTabTable query={query} />
        </Suspense>
      </Flex>
    </DatasetEvaluatorsFilterProvider>
  );
}

/**
 * The tab while the page loads, laid out as the loaded tab is: the search
 * bar over the table.
 */
export function DatasetEvaluatorsTabSkeleton() {
  return (
    <Flex direction="column" height="100%">
      <View
        padding="size-100"
        borderBottomWidth="thin"
        borderBottomColor="default"
        flex="none"
      >
        <Skeleton height="var(--global-input-height-m)" />
      </View>
      <DatasetEvaluatorsTableSkeleton />
    </Flex>
  );
}
