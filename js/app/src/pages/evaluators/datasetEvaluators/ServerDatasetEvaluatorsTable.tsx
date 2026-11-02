import { useCallback } from "react";
import { usePaginationFragment } from "react-relay";
import { useNavigate } from "react-router";
import { graphql } from "relay-runtime";

import type { ServerDatasetEvaluatorsTable_datasetEvaluators$key } from "@phoenix/pages/evaluators/datasetEvaluators/__generated__/ServerDatasetEvaluatorsTable_datasetEvaluators.graphql";
import { DatasetEvaluatorsTable } from "@phoenix/pages/evaluators/DatasetEvaluatorsTable";

const PAGE_SIZE = 100;

/**
 * Every dataset evaluator on the server, across datasets.
 */
export function ServerDatasetEvaluatorsTable({
  query,
}: {
  query: ServerDatasetEvaluatorsTable_datasetEvaluators$key;
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
      fragment ServerDatasetEvaluatorsTable_datasetEvaluators on Query
      @refetchable(queryName: "ServerDatasetEvaluatorsTableQuery")
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
        ) @connection(key: "ServerDatasetEvaluatorsTable_datasetEvaluators") {
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
  const loadNext = useCallback(
    (
      args: NonNullable<
        Parameters<typeof _loadNext>[1]
      >["UNSTABLE_extraVariables"]
    ) => {
      _loadNext(PAGE_SIZE, { UNSTABLE_extraVariables: args });
    },
    [_loadNext]
  );
  const refetch = useCallback(
    (args: NonNullable<Parameters<typeof _refetch>[0]>) => {
      _refetch(args, { fetchPolicy: "store-and-network" });
    },
    [_refetch]
  );
  return (
    <DatasetEvaluatorsTable
      rowReferences={data.datasetEvaluators.edges.map((edge) => edge.node)}
      isLoadingNext={isLoadingNext}
      hasNext={hasNext}
      loadNext={loadNext}
      refetch={refetch}
      onRowClick={(row) => {
        navigate(`/datasets/${row.dataset.id}/evaluators/${row.id}`);
      }}
    />
  );
}
