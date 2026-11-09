import { EmptyState, EmptyStateGraphic, Flex, View } from "@phoenix/components";

/**
 * What the experiment panel shows for evaluator tasks before a dataset is
 * selected: evaluators judge dataset examples, so there is nothing to run
 * or review yet.
 */
export function EvaluatorPlaygroundEmptySource() {
  return (
    <Flex
      direction="column"
      alignItems="center"
      justifyContent="center"
      height="100%"
    >
      <View padding="size-400">
        <EmptyState
          graphic={<EmptyStateGraphic variant="dataset" />}
          title="Select a dataset"
          description="Evaluators run over the examples of a dataset. Each example's output is the response being judged; use a task's input mapping to judge another field."
        />
      </View>
    </Flex>
  );
}
