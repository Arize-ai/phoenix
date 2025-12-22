import { useFragment } from "react-relay";
import { graphql } from "relay-runtime";

import { Flex, Text, View } from "@phoenix/components";

import { BuiltInDatasetEvaluatorDetails_evaluator$key } from "./__generated__/BuiltInDatasetEvaluatorDetails_evaluator.graphql";
export function BuiltInDatasetEvaluatorDetails({
  evaluatorRef,
}: {
  evaluatorRef: BuiltInDatasetEvaluatorDetails_evaluator$key;
}) {
  const evaluator = useFragment(
    graphql`
      fragment BuiltInDatasetEvaluatorDetails_evaluator on BuiltInEvaluator {
        kind
        metadata
        inputSchema
      }
    `,
    evaluatorRef
  );

  return (
    <View padding="size-200" overflow="auto">
      <Flex direction="column" gap="size-100">
        <Text size="M">Evaluator Type: {evaluator.kind}</Text>
        <Text size="M">
          Metadata: {JSON.stringify(evaluator.metadata, null, 2)}
        </Text>
        <Text size="M">
          Input Schema: {JSON.stringify(evaluator.inputSchema, null, 2)}
        </Text>
      </Flex>
    </View>
  );
}
