import {
  DebouncedSearch,
  Flex,
  Icon,
  Icons,
  LinkButton,
  View,
} from "@phoenix/components";
import { usePromptsFilterContext } from "@phoenix/pages/prompts/PromptsFilterProvider";

export const PromptsFilterBar = () => {
  const { setFilter, filter } = usePromptsFilterContext();
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
          aria-label="Search prompts by name"
          onChange={setFilter}
          defaultValue={filter}
          placeholder="Search prompts by name"
        />
        <LinkButton
          size="M"
          leadingVisual={<Icon svg={<Icons.MessageSquareOutline />} />}
          variant="primary"
          to="/playground"
        >
          New Prompt
        </LinkButton>
      </Flex>
    </View>
  );
};
