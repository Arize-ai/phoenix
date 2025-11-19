import { useCallback } from "react";
import { usePaginationFragment } from "react-relay";
import { graphql } from "relay-runtime";

import { Empty } from "@phoenix/components";
import { DatasetEvaluatorsTable_evaluators$key } from "@phoenix/pages/dataset/evaluators/__generated__/DatasetEvaluatorsTable_evaluators.graphql";
import { useEvaluatorsFilterContext } from "@phoenix/pages/evaluators/EvaluatorsFilterProvider";
import { EvaluatorsTable } from "@phoenix/pages/evaluators/EvaluatorsTable";

const PAGE_SIZE = 100;

export const useDatasetEvaluatorsTable = (
  query: DatasetEvaluatorsTable_evaluators$key
) => {
  const { filter } = useEvaluatorsFilterContext();
  const {
    data,
    hasNext,
    isLoadingNext,
    loadNext: _loadNext,
    refetch: _refetch,
  } = usePaginationFragment(
    graphql`
      fragment DatasetEvaluatorsTable_evaluators on Dataset
      @refetchable(queryName: "DatasetEvaluatorsTableEvaluatorsQuery")
      @argumentDefinitions(
        after: { type: "String", defaultValue: null }
        first: { type: "Int", defaultValue: 100 }
        sort: { type: "EvaluatorSort", defaultValue: null }
        filter: { type: "EvaluatorFilter", defaultValue: null }
        datasetId: { type: "ID", defaultValue: null }
      ) {
        evaluators(first: $first, after: $after, sort: $sort, filter: $filter)
          @connection(key: "DatasetEvaluatorsTable_evaluators") {
          __id
          edges {
            node {
              ...EvaluatorsTable_row @arguments(datasetId: $datasetId)
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
  return {
    filter,
    data,
    hasNext,
    isLoadingNext,
    loadNext,
    refetch,
  };
};

export type UseDatasetEvaluatorsTableParams = ReturnType<
  typeof useDatasetEvaluatorsTable
>;

type DatasetEvaluatorsTableProps = UseDatasetEvaluatorsTableParams;

export const DatasetEvaluatorsTable = ({
  filter,
  data,
  hasNext,
  isLoadingNext,
  loadNext,
  refetch,
}: DatasetEvaluatorsTableProps) => {
  return (
    <EvaluatorsTable
      rowReferences={data.evaluators.edges.map((edge) => edge.node)}
      isLoadingNext={isLoadingNext}
      hasNext={hasNext}
      loadNext={loadNext}
      refetch={refetch}
      emptyState={
        <Empty
          size="S"
          message={
            filter
              ? "No evaluators found"
              : "No evaluators assigned to this dataset"
          }
        />
      }
    />
  );
};
