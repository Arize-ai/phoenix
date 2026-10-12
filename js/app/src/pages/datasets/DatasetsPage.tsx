import { Suspense, useCallback, useState } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { DebouncedSearch, Flex, Loading, View } from "@phoenix/components";
import { CanModify } from "@phoenix/components/auth";
import { DatasetLabelFilterButton } from "@phoenix/components/dataset/DatasetLabelFilterButton";
import { ColumnSelector, orderColumns } from "@phoenix/components/table";
import {
  DatasetsTableProvider,
  useDatasetsTableContext,
} from "@phoenix/contexts/DatasetsTableContext";
import {
  useAgentDataChangeFetchKey,
  useLabelFilterSearchParams,
} from "@phoenix/hooks";

import type { DatasetsPageQuery } from "./__generated__/DatasetsPageQuery.graphql";
import { CreateDatasetButton } from "./CreateDatasetButton";
import { DatasetsTable } from "./DatasetsTable";

const DATASET_COLUMNS = [
  { id: "name", label: "name", isVisibilityToggleDisabled: true },
  { id: "labels", label: "labels" },
  { id: "description", label: "description" },
  { id: "createdAt", label: "created at" },
  { id: "createdBy", label: "created by" },
  { id: "updatedAt", label: "last updated" },
  { id: "updatedBy", label: "last updated by" },
  { id: "exampleCount", label: "examples" },
  { id: "experimentCount", label: "experiments" },
  { id: "evaluatorCount", label: "evaluators" },
  { id: "metadata", label: "metadata" },
];

const REFRESH_ON = ["datasets", "datasetLabels"] as const;

export function DatasetsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <DatasetsTableProvider>
        <DatasetsPageContent />
      </DatasetsTableProvider>
    </Suspense>
  );
}

function DatasetsColumnSelector() {
  const columnVisibility = useDatasetsTableContext(
    (state) => state.columnVisibility
  );
  const setColumnVisibility = useDatasetsTableContext(
    (state) => state.setColumnVisibility
  );
  const columnOrder = useDatasetsTableContext((state) => state.columnOrder);
  const setColumnOrder = useDatasetsTableContext(
    (state) => state.setColumnOrder
  );
  const orderedColumns = orderColumns({
    columns: DATASET_COLUMNS,
    columnOrder,
  });
  return (
    <ColumnSelector
      columns={orderedColumns}
      columnVisibility={columnVisibility}
      onColumnVisibilityChange={setColumnVisibility}
      onColumnOrderChange={setColumnOrder}
    />
  );
}

export function DatasetsPageContent() {
  const [localFetchKey, setLocalFetchKey] = useState(0);
  const agentFetchKey = useAgentDataChangeFetchKey(REFRESH_ON);
  const data = useLazyLoadQuery<DatasetsPageQuery>(
    graphql`
      query DatasetsPageQuery {
        ...DatasetsTable_datasets
      }
    `,
    {},
    {
      fetchKey: localFetchKey + agentFetchKey,
      fetchPolicy: "store-and-network",
    }
  );

  const onDatasetCreated = useCallback(() => {
    setLocalFetchKey((prev) => prev + 1);
  }, []);

  const [filter, setFilter] = useState<string>("");
  // The label filter is persisted to the URL so it can be shared and survive
  // reloads.
  const [selectedLabelIds, setSelectedLabelIds] = useLabelFilterSearchParams();
  return (
    <Flex direction="column" height="100%">
      <View
        padding="size-200"
        flex="none"
        borderBottomWidth="thin"
        borderBottomColor="default"
      >
        <Flex
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          gap="size-100"
        >
          <View flex="1 1 auto" minWidth={0}>
            <DebouncedSearch
              aria-label="Search datasets by name"
              onChange={setFilter}
              placeholder="Search datasets by name"
            />
          </View>
          <Flex direction="row" alignItems="center" gap="size-100" flex="none">
            <DatasetsColumnSelector />
            <DatasetLabelFilterButton
              selectedLabelIds={selectedLabelIds}
              onSelectionChange={setSelectedLabelIds}
            />
            <CanModify>
              <CreateDatasetButton onDatasetCreated={onDatasetCreated} />
            </CanModify>
          </Flex>
        </Flex>
      </View>
      <DatasetsTable
        query={data}
        filter={filter}
        labelFilter={selectedLabelIds}
        onLabelFilterChange={setSelectedLabelIds}
      />
    </Flex>
  );
}
