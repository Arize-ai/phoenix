import { useMemo } from "react";
import { usePaginationFragment } from "react-relay";
import { useNavigate } from "react-router";
import { graphql } from "relay-runtime";

import type { DatasetEvaluatorsTabTable_datasetEvaluators$key } from "@phoenix/pages/evaluators/dataset-evaluators/__generated__/DatasetEvaluatorsTabTable_datasetEvaluators.graphql";
import { DatasetEvaluatorsTable } from "@phoenix/pages/evaluators/DatasetEvaluatorsTable";

const PAGE_SIZE = 100;

/**
 * Every dataset evaluator on the server, across datasets.
 */
export function DatasetEvaluatorsTabTable({
  query,
}: {
  query: DatasetEvaluatorsTabTable_datasetEvaluators$key;
}) {
  const navigate = useNavigate();
  const {
    data,
    hasNext,
    isLoadingNext,
    loadNext: _loadNext,
    refetch: _refetch,
  } = usePaginationFragment(
    graphql`
      fragment DatasetEvaluatorsTabTable_datasetEvaluators on Query
      @refetchable(queryName: "DatasetEvaluatorsTabTableQuery")
      @argumentDefinitions(
        after: { type: "String", defaultValue: null }
        first: { type: "Int", defaultValue: 100 }
        sort: { type: "DatasetEvaluatorSort", defaultValue: null }
        filter: { type: "DatasetEvaluatorFilter", defaultValue: null }
      ) {
        datasetEvaluators(
          first: $first
          after: $after
          sort: $sort
          filter: $filter
        ) @connection(key: "DatasetEvaluatorsTabTable_datasetEvaluators") {
          __id
          edges {
            node {
              ...DatasetEvaluatorsTable_row
            }
          }
        }
      }
    `,
    query
  );
  const connectionId = data.datasetEvaluators.__id;
  const connectionIds = useMemo(() => [connectionId], [connectionId]);
  const loadNext = (
    args: NonNullable<
      Parameters<typeof _loadNext>[1]
    >["UNSTABLE_extraVariables"]
  ) => {
    _loadNext(PAGE_SIZE, { UNSTABLE_extraVariables: args });
  };
  const refetch = (args: NonNullable<Parameters<typeof _refetch>[0]>) => {
    _refetch(args, { fetchPolicy: "store-and-network" });
  };
  return (
    <DatasetEvaluatorsTable
      rowReferences={data.datasetEvaluators.edges.map((edge) => edge.node)}
      isLoadingNext={isLoadingNext}
      hasNext={hasNext}
      loadNext={loadNext}
      refetch={refetch}
      updateConnectionIds={connectionIds}
      onRowClick={(row) => {
        navigate(`/datasets/${row.dataset.id}/evaluators/${row.id}`);
      }}
    />
  );
}
