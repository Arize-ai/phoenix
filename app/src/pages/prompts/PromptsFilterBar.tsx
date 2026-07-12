import {
  DebouncedSearch,
  Flex,
  Icon,
  Icons,
  LinkButton,
  View,
} from "@phoenix/components";
import { CanModify } from "@phoenix/components/auth";
import { ColumnSelector, mergeColumnOrder } from "@phoenix/components/table";
import { usePromptsFilterContext } from "@phoenix/pages/prompts/PromptsFilterProvider";
import { PromptsLabelMenu } from "@phoenix/pages/prompts/PromptsLabelMenu";

const PROMPT_COLUMNS = [
  { id: "name", label: "name", isVisibilityToggleDisabled: true },
  { id: "labels", label: "labels" },
  { id: "description", label: "description" },
  { id: "modelName", label: "model" },
  { id: "versionCount", label: "versions" },
  { id: "latestVersionId", label: "latest version" },
  { id: "versionTags", label: "version tags" },
  { id: "lastUpdatedAt", label: "last updated" },
];

export const PromptsFilterBar = () => {
  const {
    setFilter,
    filter,
    selectedPromptLabelIds,
    setSelectedPromptLabelIds,
    columnVisibility,
    setColumnVisibility,
    columnOrder,
    setColumnOrder,
  } = usePromptsFilterContext();
  const columnsById = new Map(
    PROMPT_COLUMNS.map((column) => [column.id, column])
  );
  const orderedColumns = mergeColumnOrder({
    columnOrder,
    columnIds: PROMPT_COLUMNS.map((column) => column.id),
  }).flatMap((columnId) => {
    const column = columnsById.get(columnId);
    return column == null ? [] : [column];
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
          aria-label="Search prompts by name"
          onChange={setFilter}
          defaultValue={filter}
          placeholder="Search prompts by name"
        />
        <Flex direction="row" alignItems="center" gap="size-100" flex="none">
          <ColumnSelector
            columns={orderedColumns}
            columnVisibility={columnVisibility}
            onColumnVisibilityChange={setColumnVisibility}
            onColumnOrderChange={setColumnOrder}
          />
          <PromptsLabelMenu
            selectedLabelIds={selectedPromptLabelIds}
            onSelectionChange={setSelectedPromptLabelIds}
          />
          <CanModify>
            <LinkButton
              size="M"
              leadingVisual={<Icon svg={<Icons.MessageSquare />} />}
              variant="primary"
              to="/playground"
            >
              New Prompt
            </LinkButton>
          </CanModify>
        </Flex>
      </Flex>
    </View>
  );
};
