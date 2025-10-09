import {
  Button,
  DebouncedSearch,
  Flex,
  Icon,
  Icons,
  View,
} from "@phoenix/components";
import { useExamplesFilterContext } from "@phoenix/pages/examples/ExamplesFilterContext";

export const ExamplesFilterBar = () => {
  const { setFilter, filter } = useExamplesFilterContext();
  return (
    <View padding="size-100">
      <Flex
        width="100%"
        justifyContent="space-between"
        gap="size-100"
        alignItems="center"
        wrap="nowrap"
      >
        <DebouncedSearch
          defaultValue={filter}
          onChange={setFilter}
          placeholder="Search examples by input, output, or metadata"
          aria-label="Search examples"
        />
        <Flex gap="size-100" alignItems="center">
          <Button
            trailingVisual={<Icon svg={<Icons.ChevronDown />} />}
            onPress={() => alert("Not implemented")}
          >
            Splits
          </Button>
        </Flex>
      </Flex>
    </View>
  );
};
