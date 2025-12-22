import { useFragment } from "react-relay";
import { graphql } from "relay-runtime";

import { Flex, View } from "@phoenix/components";
import { ContainsEvaluatorCodeBlock } from "@phoenix/components/evaluators/ContainsEvaluatorCodeBlock";

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
        name
        metadata
        inputSchema
        isBuiltin
      }
    `,
    evaluatorRef
  );

  if (evaluator.kind !== "CODE") {
    throw new Error(
      "BuiltInDatasetEvaluatorDetails called for non-CODE evaluator"
    );
  }

  let CodeBlock;
  if (evaluator.isBuiltin && evaluator.name?.toLowerCase() === "contains") {
    CodeBlock = ContainsEvaluatorCodeBlock;
  } else {
    throw new Error(
      "Unknown built-in evaluator or code evaluator not implemented"
    );
  }

  return (
    <View padding="size-200" overflow="auto">
      <Flex direction="column" gap="size-200">
        <CodeBlock />
      </Flex>
    </View>
  );
}
