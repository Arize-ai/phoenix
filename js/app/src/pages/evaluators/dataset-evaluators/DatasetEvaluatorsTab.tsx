import { Suspense } from "react";
import { useLoaderData } from "react-router";
import invariant from "tiny-invariant";

import { Flex } from "@phoenix/components";
import { TableSkeleton } from "@phoenix/components/table";
import { useOwnedPreloadedQuery } from "@phoenix/hooks";
import type { datasetEvaluatorsTabLoaderQuery } from "@phoenix/pages/evaluators/dataset-evaluators/__generated__/datasetEvaluatorsTabLoaderQuery.graphql";
import type { DatasetEvaluatorsTabLoaderType } from "@phoenix/pages/evaluators/dataset-evaluators/datasetEvaluatorsTabLoader";
import { datasetEvaluatorsTabLoaderGql } from "@phoenix/pages/evaluators/dataset-evaluators/datasetEvaluatorsTabLoader";
import { DatasetEvaluatorsTabTable } from "@phoenix/pages/evaluators/dataset-evaluators/DatasetEvaluatorsTabTable";
import { DatasetEvaluatorsFilterBar } from "@phoenix/pages/evaluators/DatasetEvaluatorsFilterBar";
import { DatasetEvaluatorsFilterProvider } from "@phoenix/pages/evaluators/DatasetEvaluatorsFilterProvider";

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
        <DatasetEvaluatorsFilterBar placeholder="Search evaluators or datasets" />
        <Suspense fallback={<TableSkeleton rowCount="fill" />}>
          <DatasetEvaluatorsTabTable query={query} />
        </Suspense>
      </Flex>
    </DatasetEvaluatorsFilterProvider>
  );
}
