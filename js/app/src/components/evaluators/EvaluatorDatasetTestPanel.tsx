import type { ReactNode } from "react";

import { Flex, View } from "@phoenix/components";
import { EvaluatorExampleDataset } from "@phoenix/components/evaluators/EvaluatorExampleDataset";
import { EvaluatorInputPreview } from "@phoenix/components/evaluators/EvaluatorInputPreview";
import { EvaluatorOutputPreview } from "@phoenix/components/evaluators/EvaluatorOutputPreview";

/**
 * Test an evaluator against dataset examples.
 * Requires `dataset` to be set in the evaluator store.
 */
export const EvaluatorDatasetTestPanel = ({
  testSection = <EvaluatorOutputPreview />,
}: {
  /** The test button and its results. Defaults to the LLM and built-in test. */
  testSection?: ReactNode;
}) => (
  <Flex direction="column" gap="size-200">
    <View paddingX="size-200">
      <Flex direction="column" gap="size-100">
        {testSection}
        <EvaluatorExampleDataset />
      </Flex>
    </View>
    <EvaluatorInputPreview />
  </Flex>
);
