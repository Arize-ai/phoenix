import { DebouncedSearch, Flex, View } from "@phoenix/components";
import { AddProjectEvaluatorMenu } from "@phoenix/pages/project/evaluators/AddProjectEvaluatorMenu";
import type { ProjectEvaluatorCreationMode } from "@phoenix/pages/project/evaluators/CreateProjectEvaluatorSlideover";

/**
 * The evaluators tab's own header: search on the left, creation on the right.
 * Both live in the tab's content rather than the project tab bar, so the tab
 * bar stays pure navigation and this page owns its creation state.
 */
export function ProjectEvaluatorsToolbar({
  filter,
  onFilterChange,
  onSelectCreationMode,
}: {
  filter: string;
  onFilterChange: (filter: string) => void;
  onSelectCreationMode: (mode: ProjectEvaluatorCreationMode) => void;
}) {
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
          <AddProjectEvaluatorMenu
            size="M"
            onSelectCreationMode={onSelectCreationMode}
          />
        </Flex>
      </Flex>
    </View>
  );
}
