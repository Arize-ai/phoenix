import { Flex, Heading, Text, View } from "@phoenix/components";
import { useEvaluatorStore } from "@phoenix/contexts/EvaluatorContext";

import { ReadOnlyCategoricalConfig } from "./ReadOnlyCategoricalConfig";
import { ReadOnlyContinuousConfig } from "./ReadOnlyContinuousConfig";

/**
 * A store-connected wrapper for displaying evaluator output configuration
 * in built-in evaluator forms. Uses read-only display for name and values/bounds,
 * but allows editing the optimization direction.
 */
export const BuiltInEvaluatorOutputConfig = () => {
  const outputConfig = useEvaluatorStore((state) => state.outputConfig);

  if (!outputConfig) {
    return null;
  }

  const isCategorical = "values" in outputConfig;

  return (
    <View marginBottom="size-200" flex="none">
      <Flex direction="column" gap="size-100">
        <Heading level={2} weight="heavy">
          Evaluator Annotation
        </Heading>
        <Text color="text-500">
          The annotation that this evaluator will create.
        </Text>
        {isCategorical ? (
          <ReadOnlyCategoricalConfig />
        ) : (
          <ReadOnlyContinuousConfig />
        )}
      </Flex>
    </View>
  );
};
