import { Suspense, useMemo } from "react";
import { usePreloadedQuery } from "react-relay";
import { useLoaderData, useParams } from "react-router";
import invariant from "tiny-invariant";

import { Loading } from "@phoenix/components";
import { AddEvaluatorMenu } from "@phoenix/components/evaluators/AddEvaluatorMenu";
import {
  datasetEvaluatorsLoader,
  datasetEvaluatorsLoaderGQL,
} from "@phoenix/pages/dataset/evaluators/datasetEvaluatorsLoader";
import {
  DatasetEvaluatorsTable,
  useDatasetEvaluatorsTable,
} from "@phoenix/pages/dataset/evaluators/DatasetEvaluatorsTable";
import { EvaluatorsFilterBar } from "@phoenix/pages/evaluators/EvaluatorsFilterBar";
import { EvaluatorsFilterProvider } from "@phoenix/pages/evaluators/EvaluatorsFilterProvider";

export function DatasetEvaluatorsPage() {
  return (
    <EvaluatorsFilterProvider>
      <Suspense fallback={<Loading />}>
        <DatasetEvaluatorsPageContent />
      </Suspense>
    </EvaluatorsFilterProvider>
  );
}

export function DatasetEvaluatorsPageContent() {
  const { datasetId } = useParams();
  invariant(datasetId, "datasetId is required");

  const loaderData = useLoaderData<typeof datasetEvaluatorsLoader>();
  invariant(loaderData, "loaderData is required");
  const data = usePreloadedQuery(datasetEvaluatorsLoaderGQL, loaderData);
  const evaluatorsTableProps = useDatasetEvaluatorsTable(data.dataset);
  const evaluatorsTableData = evaluatorsTableProps.data;

  const connectionsToUpdate = useMemo(() => {
    if (evaluatorsTableData.evaluators.__id) {
      return [evaluatorsTableData.evaluators.__id];
    }
    return [];
  }, [evaluatorsTableData]);

  return (
    <main>
      <EvaluatorsFilterBar
        padding="size-100"
        extraActions={
          <AddEvaluatorMenu
            size="M"
            datasetId={datasetId}
            updateConnectionIds={connectionsToUpdate}
            query={data}
          />
        }
      />
      <Suspense fallback={<Loading />}>
        <DatasetEvaluatorsTable {...evaluatorsTableProps} />
      </Suspense>
    </main>
  );
}
