import { DebouncedSearch, Flex, View } from "@phoenix/components";
import { AddProjectEvaluatorMenu } from "@phoenix/pages/project/evaluators/AddProjectEvaluatorMenu";
import { useProjectEvaluatorPaths } from "@phoenix/pages/project/evaluators/projectEvaluatorPaths";

/**
 * The evaluators tab's own header: search on the left, creation on the right.
 * Both live in the tab's content rather than the project tab bar, so the tab
 * bar stays pure navigation.
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
          <AddProjectEvaluatorMenu
            size="M"
            creationPaths={paths.listCreation}
          />
        </Flex>
      </Flex>
    </View>
  );
}
