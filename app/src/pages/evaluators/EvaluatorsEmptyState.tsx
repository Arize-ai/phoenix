import { Flex, Text, View } from "@phoenix/components";

export const EvaluatorsEmptyState = ({
  hasActiveFilter,
}: {
  hasActiveFilter: boolean;
}) => {
  if (hasActiveFilter) {
    return (
      <View width="100%" paddingY="size-400">
        <Flex
          direction="column"
          width="100%"
          alignItems="center"
          justifyContent="center"
        >
          <Text size="S" fontStyle="italic" color="text-700">
            No evaluators found that match the given filter.
          </Text>
        </Flex>
      </View>
    );
  }

  return (
    <View width="100%" paddingY="size-400">
      <Flex
        direction="column"
        width="100%"
        alignItems="center"
        justifyContent="center"
      >
        <Text size="S" fontStyle="italic" color="text-700">
          No evaluators found.
        </Text>
      </Flex>
    </View>
  );
};
