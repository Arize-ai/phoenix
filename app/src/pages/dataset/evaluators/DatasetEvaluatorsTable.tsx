import { useCallback, useMemo } from "react";
import { usePaginationFragment } from "react-relay";
import { useParams } from "react-router";
import { graphql } from "relay-runtime";
import invariant from "tiny-invariant";

import { Empty } from "@phoenix/components";
import { DatasetEvaluatorsTable_evaluators$key } from "@phoenix/pages/dataset/evaluators/__generated__/DatasetEvaluatorsTable_evaluators.graphql";
import { DatasetEvaluatorsTable as BaseDatasetEvaluatorsTable } from "@phoenix/pages/evaluators/DatasetEvaluatorsTable";
import { useEvaluatorsFilterContext } from "@phoenix/pages/evaluators/EvaluatorsFilterProvider";

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
      ) {
        evaluators(first: $first, after: $after, sort: $sort, filter: $filter)
          @connection(key: "DatasetEvaluatorsTable_evaluators") {
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

const EMPTY_CONNECTION_IDS: string[] = [];

export const DatasetEvaluatorsTable = ({
  filter,
  data,
  hasNext,
  isLoadingNext,
  loadNext,
  refetch,
}: DatasetEvaluatorsTableProps) => {
  const { datasetId } = useParams();
  invariant(datasetId, "datasetId is required");
  const connectionsToUpdate = useMemo(() => {
    if (data.evaluators.__id) {
      return [data.evaluators.__id];
    }
    return EMPTY_CONNECTION_IDS;
  }, [data]);
  return (
    <BaseDatasetEvaluatorsTable
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
      datasetId={datasetId}
      updateConnectionIds={connectionsToUpdate}
    />
  );
};
