import {
  DebouncedSearch,
  Flex,
  Icon,
  Icons,
  LinkButton,
  View,
} from "@phoenix/components";
import { CanModify } from "@phoenix/components/auth";
import { ColumnSelector, orderColumns } from "@phoenix/components/table";
import { useDecisionsFilterContext } from "@phoenix/pages/decisions/DecisionsFilterProvider";
import { DecisionsLabelMenu } from "@phoenix/pages/decisions/DecisionsLabelMenu";
import { useDecisionsTableContext } from "@phoenix/pages/decisions/DecisionsTableContext";

const DECISION_COLUMNS = [
  { id: "name", label: "name", isVisibilityToggleDisabled: true },
  { id: "labels", label: "labels" },
  { id: "description", label: "description" },
  { id: "modelName", label: "model" },
  { id: "versionCount", label: "versions" },
  { id: "latestVersionId", label: "latest version" },
  { id: "versionTags", label: "version tags" },
  { id: "createdBy", label: "created by" },
  { id: "updatedBy", label: "last updated by" },
  { id: "lastUpdatedAt", label: "last updated" },
];

export const DecisionsFilterBar = () => {
  const {
    setFilter,
    filter,
    selectedDecisionLabelIds,
    setSelectedDecisionLabelIds,
  } = useDecisionsFilterContext();
  const columnVisibility = useDecisionsTableContext(
    (state) => state.columnVisibility
  );
  const setColumnVisibility = useDecisionsTableContext(
    (state) => state.setColumnVisibility
  );
  const columnOrder = useDecisionsTableContext((state) => state.columnOrder);
  const setColumnOrder = useDecisionsTableContext(
    (state) => state.setColumnOrder
  );
  const orderedColumns = orderColumns({
    columns: DECISION_COLUMNS,
    columnOrder,
  });

  return (
    <View
      padding="size-200"
      borderBottomWidth="thin"
      borderBottomColor="default"
      flex="none"
    >
      <Flex
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        gap="size-100"
      >
        <DebouncedSearch
          aria-label="Search decisions by name"
          onChange={setFilter}
          defaultValue={filter}
          placeholder="Search decisions by name"
        />
        <Flex direction="row" alignItems="center" gap="size-100" flex="none">
          <ColumnSelector
            columns={orderedColumns}
            columnVisibility={columnVisibility}
            onColumnVisibilityChange={setColumnVisibility}
            onColumnOrderChange={setColumnOrder}
          />
          <DecisionsLabelMenu
            selectedLabelIds={selectedDecisionLabelIds}
            onSelectionChange={setSelectedDecisionLabelIds}
          />
          <CanModify>
            <LinkButton
              size="M"
              leadingVisual={<Icon svg={<Icons.MessageSquare />} />}
              variant="primary"
              to="/playground?newDecision=true"
            >
              New Decision
            </LinkButton>
          </CanModify>
        </Flex>
      </Flex>
    </View>
  );
};
