import { createContext, useContext } from "react";
import invariant from "tiny-invariant";

import type { EvaluatorCategory } from "@phoenix/pages/project/evaluators/__generated__/projectEvaluatorTemplatesQuery.graphql";

/**
 * The initial gallery target. Every target is validated against the loaded
 * gallery, so an unavailable category, template, or evaluator falls back to
 * the first available card.
 */
export type ProjectEvaluatorGallerySelection =
  | { kind: "default" }
  | { kind: "category"; category: EvaluatorCategory }
  | { kind: "template"; templateName: string }
  | { kind: "evaluator"; evaluatorId: string };

type ProjectEvaluatorContextValue = {
  openGallery: (selection?: ProjectEvaluatorGallerySelection) => void;
  onEvaluatorCreated: () => void;
};

const ProjectEvaluatorContext =
  createContext<ProjectEvaluatorContextValue | null>(null);

export const ProjectEvaluatorProvider = ProjectEvaluatorContext.Provider;

/** Returns the actions owned by the project evaluators page. */
export function useProjectEvaluatorContext() {
  const context = useContext(ProjectEvaluatorContext);
  invariant(
    context,
    "useProjectEvaluatorContext must be used within the evaluators page"
  );
  return context;
}
