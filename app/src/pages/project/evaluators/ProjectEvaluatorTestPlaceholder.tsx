import { Empty, Flex, Heading, View } from "@phoenix/components";

/**
 * Placeholder for the project evaluator test section. Unlike dataset
 * evaluators, which test against dataset examples, project evaluators will
 * test against recent spans, traces, or sessions — that flow is not built yet.
 */
export const ProjectEvaluatorTestPlaceholder = () => {
  return (
    <View paddingX="size-200">
      <Flex direction="column" gap="size-100">
        <Heading level={2} weight="heavy">
          Test
        </Heading>
        <Empty message="Testing against live spans, traces, and sessions is coming soon." />
      </Flex>
    </View>
  );
};
