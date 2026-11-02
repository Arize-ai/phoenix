import { Suspense } from "react";
import { useLoaderData } from "react-router";
import invariant from "tiny-invariant";

import { Flex } from "@phoenix/components";
import { TableSkeleton } from "@phoenix/components/table";
import { useOwnedPreloadedQuery } from "@phoenix/hooks";
import type { serverDatasetEvaluatorsLoaderQuery } from "@phoenix/pages/evaluators/datasetEvaluators/__generated__/serverDatasetEvaluatorsLoaderQuery.graphql";
import type { ServerDatasetEvaluatorsLoaderType } from "@phoenix/pages/evaluators/datasetEvaluators/serverDatasetEvaluatorsLoader";
import { serverDatasetEvaluatorsLoaderGql } from "@phoenix/pages/evaluators/datasetEvaluators/serverDatasetEvaluatorsLoader";
import { ServerDatasetEvaluatorsTable } from "@phoenix/pages/evaluators/datasetEvaluators/ServerDatasetEvaluatorsTable";
import { DatasetEvaluatorsFilterBar } from "@phoenix/pages/evaluators/DatasetEvaluatorsFilterBar";
import { DatasetEvaluatorsFilterProvider } from "@phoenix/pages/evaluators/DatasetEvaluatorsFilterProvider";

/**
 * The Evaluators page's Dataset evaluators tab: every evaluator attached to a
 * dataset, across datasets.
 */
export function ServerDatasetEvaluatorsPage() {
  const loaderData = useLoaderData<ServerDatasetEvaluatorsLoaderType>();
  invariant(loaderData, "loaderData is required");
  const query = useOwnedPreloadedQuery<serverDatasetEvaluatorsLoaderQuery>({
    query: serverDatasetEvaluatorsLoaderGql,
    queryRef: loaderData,
  });
  return (
    <DatasetEvaluatorsFilterProvider>
      <Flex direction="column" height="100%">
        <DatasetEvaluatorsFilterBar placeholder="Search evaluators or datasets" />
        <Suspense fallback={<TableSkeleton rowCount="fill" />}>
          <ServerDatasetEvaluatorsTable query={query} />
        </Suspense>
      </Flex>
    </DatasetEvaluatorsFilterProvider>
  );
}
