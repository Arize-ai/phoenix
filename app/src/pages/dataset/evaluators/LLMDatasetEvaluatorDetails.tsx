import { useFragment } from "react-relay";
import { graphql } from "relay-runtime";

import { Flex, Text, View } from "@phoenix/components";
import { LLMDatasetEvaluatorDetails_evaluator$key } from "@phoenix/pages/dataset/evaluators/__generated__/LLMDatasetEvaluatorDetails_evaluator.graphql";

export function LLMDatasetEvaluatorDetails({
  evaluatorRef,
}: {
  evaluatorRef: LLMDatasetEvaluatorDetails_evaluator$key;
}) {
  const evaluator = useFragment(
    graphql`
      fragment LLMDatasetEvaluatorDetails_evaluator on LLMEvaluator {
        kind
        prompt {
          id
          name
        }
      }
    `,
    evaluatorRef
  );

  return (
    <View padding="size-200">
      <Flex direction="column" gap="size-100">
        <Text size="M">Evaluator Type: {evaluator.kind}</Text>
        <Text size="M">
          Prompt: {JSON.stringify(evaluator.prompt, null, 2)}
        </Text>
      </Flex>
    </View>
  );
}
