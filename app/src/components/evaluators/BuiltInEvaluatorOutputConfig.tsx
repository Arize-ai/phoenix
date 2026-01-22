import { Card, View } from "@phoenix/components";
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
    <Card title="Evaluator Annotation" backgroundColor="grey-100">
      <View padding="size-200">
        {isCategorical ? (
          <ReadOnlyCategoricalConfig />
        ) : (
          <ReadOnlyContinuousConfig />
        )}
      </View>
    </Card>
  );
};
