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
  const setOutputConfigOptimizationDirection = useEvaluatorStore(
    (state) => state.setOutputConfigOptimizationDirection
  );

  if (!outputConfig) {
    return null;
  }

  let Component;

  if ("values" in outputConfig) {
    Component = (
      <ReadOnlyCategoricalConfig
        name={outputConfig.name}
        optimizationDirection={outputConfig.optimizationDirection}
        onOptimizationDirectionChange={setOutputConfigOptimizationDirection}
        values={outputConfig.values}
      />
    );
  } else {
    Component = (
      <ReadOnlyContinuousConfig
        name={outputConfig.name}
        optimizationDirection={outputConfig.optimizationDirection}
        onOptimizationDirectionChange={setOutputConfigOptimizationDirection}
        lowerBound={outputConfig.lowerBound}
        upperBound={outputConfig.upperBound}
      />
    );
  }

  return (
    <Card title="Evaluator Annotation" backgroundColor="grey-100">
      <View padding="size-200">{Component}</View>
    </Card>
  );
};
