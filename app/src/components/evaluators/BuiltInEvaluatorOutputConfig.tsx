import { useEvaluatorStore } from "@phoenix/contexts/EvaluatorContext";

import { MultiOutputConfigEditor } from "./MultiOutputConfigEditor";

/**
 * A store-connected wrapper for displaying evaluator output configuration
 * in built-in evaluator forms. Uses read-only display for name and values/bounds,
 * but allows editing the optimization direction.
 *
 * For built-in evaluators with multiple outputs, this displays them in an accordion.
 * Add/remove is disabled since configs are predefined by the evaluator.
 */
export const BuiltInEvaluatorOutputConfig = () => {
  const outputConfigs = useEvaluatorStore((state) => state.outputConfigs);

  if (!outputConfigs || outputConfigs.length === 0) {
    return null;
  }

  return (
    <MultiOutputConfigEditor
      isReadOnly
      hideAddRemove
      title="Evaluator Annotation"
      description="The annotation that this evaluator will create."
    />
  );
};
