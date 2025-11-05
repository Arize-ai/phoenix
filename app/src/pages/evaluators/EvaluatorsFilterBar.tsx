import {
  DebouncedSearch,
  Flex,
  Icon,
  Icons,
  LinkButton,
  View,
} from "@phoenix/components";
import { useEvaluatorsFilterContext } from "@phoenix/pages/evaluators/EvaluatorsFilterProvider";

export const EvaluatorsFilterBar = () => {
  const { setFilter, filter } = useEvaluatorsFilterContext();

  return (
    <View
      padding="size-200"
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
        <Flex direction="row" alignItems="center" gap="size-100" flex="none">
          <LinkButton
            size="M"
            leadingVisual={<Icon svg={<Icons.Scale />} />}
            variant="primary"
            to="/evaluators/new"
          >
            New Evaluator
          </LinkButton>
        </Flex>
      </Flex>
    </View>
  );
};
