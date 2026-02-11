import { DebouncedSearch, Flex, View, ViewProps } from "@phoenix/components";
import { useDatasetEvaluatorsFilterContext } from "@phoenix/pages/evaluators/DatasetEvaluatorsFilterProvider";

export const DatasetEvaluatorsFilterBar = ({
  extraActions,
  padding = "size-200",
}: {
  extraActions?: React.ReactNode;
  padding?: ViewProps["padding"];
}) => {
  const { setFilter, filter } = useDatasetEvaluatorsFilterContext();

  return (
    <View
      padding={padding}
      borderBottomWidth="thin"
      borderBottomColor="grey-200"
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
          onChange={setFilter}
          defaultValue={filter}
          placeholder="Search evaluators by name"
        />
        {!!extraActions && (
          <Flex direction="row" alignItems="center" gap="size-100" flex="none">
            {extraActions}
          </Flex>
        )}
      </Flex>
    </View>
  );
};
