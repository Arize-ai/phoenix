import { createContext, useContext, type ReactNode } from "react";

import type { MaterializedEvaluatorContext } from "@phoenix/components/evaluators/evaluatorContext";

const TemplateEvaluatorContext =
  createContext<MaterializedEvaluatorContext | null>(null);

/**
 * Supplies what an evaluator's template receives, for every editor beneath it.
 *
 * The template editor is mounted deep inside the playground's own tree, which
 * knows nothing about evaluators; this carries the authoring context past it
 * without threading an evaluator-only prop through the playground.
 */
export function TemplateEvaluatorContextProvider({
  value,
  children,
}: {
  value: MaterializedEvaluatorContext | null;
  children: ReactNode;
}) {
  return (
    <TemplateEvaluatorContext.Provider value={value}>
      {children}
    </TemplateEvaluatorContext.Provider>
  );
}

/** Null wherever the template is not authoring a project evaluator. */
export function useTemplateEvaluatorContext(): MaterializedEvaluatorContext | null {
  return useContext(TemplateEvaluatorContext);
}
