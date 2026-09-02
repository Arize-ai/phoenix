import { DebouncedSearch, Flex, View } from "@phoenix/components";
import { ColumnSelector, orderColumns } from "@phoenix/components/table";
import { useProjectEvaluatorsTableContext } from "@phoenix/contexts/ProjectEvaluatorsTableContext";
import { AddProjectEvaluatorMenu } from "@phoenix/pages/project/evaluators/AddProjectEvaluatorMenu";
import { useProjectEvaluatorPaths } from "@phoenix/pages/project/evaluators/projectEvaluatorPaths";

/**
 * The selectable columns of {@link ProjectEvaluatorsTable}, in their natural
 * order. The pinned enabled and actions columns are excluded: they stay put
 * on the table's right edge.
 */
const PROJECT_EVALUATOR_COLUMNS = [
  { id: "name", label: "name", isVisibilityToggleDisabled: true },
  { id: "status", label: "status" },
  { id: "kind", label: "kind" },
  { id: "meanScore", label: "mean score" },
  { id: "prompt", label: "prompt" },
  { id: "model", label: "model" },
  { id: "cost", label: "total cost" },
  { id: "averageCost", label: "avg cost / run" },
  { id: "language", label: "language" },
  { id: "sandbox", label: "sandbox" },
  { id: "target", label: "target" },
  { id: "filter", label: "filter" },
  { id: "sampling", label: "sampling" },
  { id: "updatedAt", label: "last updated" },
];

function ProjectEvaluatorsColumnSelector() {
  const columnVisibility = useProjectEvaluatorsTableContext(
    (state) => state.columnVisibility
  );
  const setColumnVisibility = useProjectEvaluatorsTableContext(
    (state) => state.setColumnVisibility
  );
  const columnOrder = useProjectEvaluatorsTableContext(
    (state) => state.columnOrder
  );
  const setColumnOrder = useProjectEvaluatorsTableContext(
    (state) => state.setColumnOrder
  );
  const orderedColumns = orderColumns({
    columns: PROJECT_EVALUATOR_COLUMNS,
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

/**
 * The evaluators tab's own header: search on the left, table configuration
 * and creation on the right. All live in the tab's content rather than the
 * project tab bar, so the tab bar stays pure navigation.
 */
export function ProjectEvaluatorsToolbar({
  filter,
  onFilterChange,
}: {
  filter: string;
  onFilterChange: (filter: string) => void;
}) {
  const paths = useProjectEvaluatorPaths();
  return (
    <View
      padding="size-100"
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
          aria-label="Search evaluators by name"
          placeholder="Search evaluators by name"
          defaultValue={filter}
          onChange={onFilterChange}
        />
        <Flex direction="row" alignItems="center" gap="size-100" flex="none">
          <ProjectEvaluatorsColumnSelector />
          <AddProjectEvaluatorMenu
            size="M"
            creationPaths={paths.listCreation}
          />
        </Flex>
      </Flex>
    </View>
  );
}
