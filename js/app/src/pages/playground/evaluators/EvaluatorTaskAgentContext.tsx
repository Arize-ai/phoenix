import type { ReactNode } from "react";
import { createContext, useContext } from "react";

import type { EvaluatorTaskAgentRegistry } from "./evaluatorTaskAgentRegistry";

const EvaluatorTaskAgentContext =
  createContext<EvaluatorTaskAgentRegistry | null>(null);

/**
 * Hands the page's registry to the evaluator task editors, which register
 * their PXI adapters in it while mounted.
 */
export function EvaluatorTaskAgentProvider({
  registry,
  children,
}: {
  registry: EvaluatorTaskAgentRegistry;
  children: ReactNode;
}) {
  return (
    <EvaluatorTaskAgentContext.Provider value={registry}>
      {children}
    </EvaluatorTaskAgentContext.Provider>
  );
}

export function useEvaluatorTaskAgentRegistry(): EvaluatorTaskAgentRegistry {
  const registry = useContext(EvaluatorTaskAgentContext);
  if (!registry) {
    throw new Error("Missing EvaluatorTaskAgentProvider in the tree");
  }
  return registry;
}
