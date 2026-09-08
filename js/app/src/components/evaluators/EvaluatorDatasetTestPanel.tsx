import { Flex, View } from "@phoenix/components";
import { EvaluatorExampleDataset } from "@phoenix/components/evaluators/EvaluatorExampleDataset";
import { EvaluatorInputPreview } from "@phoenix/components/evaluators/EvaluatorInputPreview";
import { EvaluatorOutputPreview } from "@phoenix/components/evaluators/EvaluatorOutputPreview";

/**
 * Test an evaluator against dataset examples.
 * Requires `dataset` to be set in the evaluator store.
 */
export const EvaluatorDatasetTestPanel = () => (
  <Flex direction="column" gap="size-200">
    <View paddingX="size-200">
      <Flex direction="column" gap="size-100">
        <EvaluatorOutputPreview />
        <EvaluatorExampleDataset />
      </Flex>
    </View>
    <EvaluatorInputPreview />
  </Flex>
);
