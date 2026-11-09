import { createContext, type ReactNode, useContext } from "react";

import type { AnnotationConfig } from "@phoenix/components/annotation/types";

/**
 * The output configs preview results are coloured against, for evaluators
 * whose configs the evaluator store does not hold. A decision evaluator's
 * outputs derive from its questions and scoring policy, so its form provides
 * them here, and a direction edit recolours results already on
 * screen without a re-run.
 */
export type EvaluatorPreviewOutputConfigs = {
  outputConfigs: AnnotationConfig[];
  /**
   * The name the previewed evaluator writes under, when it is not the
   * store's: multi-output results are named `evaluatorName.configName`.
   */
  evaluatorName?: string;
};

const EvaluatorPreviewOutputConfigsContext =
  createContext<EvaluatorPreviewOutputConfigs | null>(null);

export function EvaluatorPreviewOutputConfigsProvider({
  value,
  children,
}: {
  value: EvaluatorPreviewOutputConfigs;
  children: ReactNode;
}) {
  return (
    <EvaluatorPreviewOutputConfigsContext.Provider value={value}>
      {children}
    </EvaluatorPreviewOutputConfigsContext.Provider>
  );
}

/** The provided preview output configs, or null outside a provider. */
export function useEvaluatorPreviewOutputConfigs(): EvaluatorPreviewOutputConfigs | null {
  return useContext(EvaluatorPreviewOutputConfigsContext);
}
