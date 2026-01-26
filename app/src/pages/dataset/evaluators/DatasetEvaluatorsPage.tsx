import { Suspense, useMemo } from "react";
import { useFragment, usePreloadedQuery } from "react-relay";
import { useLoaderData, useParams } from "react-router";
import { graphql } from "relay-runtime";
import invariant from "tiny-invariant";

import { Loading } from "@phoenix/components";
import { AddEvaluatorMenu } from "@phoenix/components/evaluators/AddEvaluatorMenu";
import { DatasetEvaluatorsPage_builtInEvaluators$key } from "@phoenix/pages/dataset/evaluators/__generated__/DatasetEvaluatorsPage_builtInEvaluators.graphql";
import {
  datasetEvaluatorsLoader,
  datasetEvaluatorsLoaderGQL,
} from "@phoenix/pages/dataset/evaluators/datasetEvaluatorsLoader";
import {
  DatasetEvaluatorsTable,
  useDatasetEvaluatorsTable,
} from "@phoenix/pages/dataset/evaluators/DatasetEvaluatorsTable";
import { DatasetEvaluatorsFilterBar } from "@phoenix/pages/evaluators/DatasetEvaluatorsFilterBar";
import { DatasetEvaluatorsFilterProvider } from "@phoenix/pages/evaluators/DatasetEvaluatorsFilterProvider";

export function DatasetEvaluatorsPage() {
  return (
    <DatasetEvaluatorsFilterProvider>
      <Suspense fallback={<Loading />}>
        <DatasetEvaluatorsPageContent />
      </Suspense>
    </DatasetEvaluatorsFilterProvider>
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

  const builtInEvaluators =
    useFragment<DatasetEvaluatorsPage_builtInEvaluators$key>(
      graphql`
        fragment DatasetEvaluatorsPage_builtInEvaluators on Query {
          builtInEvaluators {
            id
            name
            description
            kind
          }
          classificationEvaluatorConfigs {
            name
            description
          }
        }
      `,
      data
    );

  const connectionsToUpdate = useMemo(() => {
    if (evaluatorsTableData.datasetEvaluators.__id) {
      return [evaluatorsTableData.datasetEvaluators.__id];
    }
    return [];
  }, [evaluatorsTableData]);

  return (
    <main>
      <DatasetEvaluatorsFilterBar
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
        <DatasetEvaluatorsTable
          {...evaluatorsTableProps}
          builtInEvaluators={builtInEvaluators}
        />
      </Suspense>
    </main>
  );
}
