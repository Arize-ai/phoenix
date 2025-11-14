import { useCallback, useState } from "react";
import { usePaginationFragment } from "react-relay";
import { graphql } from "relay-runtime";

import { EditEvaluatorSlideover } from "@phoenix/components/evaluators/EditEvaluatorSlideover";
import { GlobalEvaluatorsTable_evaluators$key } from "@phoenix/pages/evaluators/__generated__/GlobalEvaluatorsTable_evaluators.graphql";
import {
  EvaluatorsTable,
  TableRow,
} from "@phoenix/pages/evaluators/EvaluatorsTable";

const PAGE_SIZE = 100;

export const GlobalEvaluatorsTable = ({
  query,
}: {
  query: GlobalEvaluatorsTable_evaluators$key;
}) => {
  const {
    data,
    hasNext,
    isLoadingNext,
    loadNext: _loadNext,
    refetch: _refetch,
  } = usePaginationFragment(
    graphql`
      fragment GlobalEvaluatorsTable_evaluators on Query
      @refetchable(queryName: "GlobalEvaluatorsTableEvaluatorsQuery")
      @argumentDefinitions(
        after: { type: "String", defaultValue: null }
        first: { type: "Int", defaultValue: 100 }
        sort: { type: "EvaluatorSort", defaultValue: null }
        filter: { type: "EvaluatorFilter", defaultValue: null }
        datasetId: { type: "ID", defaultValue: null }
      ) {
        evaluators(first: $first, after: $after, sort: $sort, filter: $filter)
          @connection(key: "EvaluatorsTable_evaluators") {
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
  const [selectedEvaluatorId, setSelectedEvaluatorId] = useState<string | null>(
    null
  );
  const onRowClick = useCallback((row: TableRow) => {
    setSelectedEvaluatorId(row.id);
  }, []);
  const onOpenChange = useCallback((isOpen: boolean) => {
    if (!isOpen) {
      setSelectedEvaluatorId(null);
    }
  }, []);
  return (
    <>
      <EvaluatorsTable
        rowReferences={data.evaluators.edges.map((edge) => edge.node)}
        isLoadingNext={isLoadingNext}
        hasNext={hasNext}
        loadNext={loadNext}
        refetch={refetch}
        onRowClick={onRowClick}
      />
      <EditEvaluatorSlideover
        evaluatorId={selectedEvaluatorId ?? ""}
        isOpen={!!selectedEvaluatorId}
        onOpenChange={onOpenChange}
      />
    </>
  );
};
