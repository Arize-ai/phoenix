import { createContext, useContext } from "react";
import invariant from "tiny-invariant";

import type { EvaluatorCategory } from "@phoenix/pages/project/evaluators/__generated__/projectEvaluatorTemplatesQuery.graphql";

export type ProjectEvaluatorGallerySelection =
  | { kind: "default" }
  | { kind: "category"; category: EvaluatorCategory }
  | { kind: "template"; templateName: string }
  | { kind: "evaluator"; evaluatorId: string };

type ProjectEvaluatorContextValue = {
  openGallery: (selection?: ProjectEvaluatorGallerySelection) => void;
};

const ProjectEvaluatorContext =
  createContext<ProjectEvaluatorContextValue | null>(null);

export const ProjectEvaluatorProvider = ProjectEvaluatorContext.Provider;

/**
 * Opens the evaluator gallery over the evaluator list, optionally at a card.
 *
 * The gallery is modal state on the list page rather than a destination, so
 * opening it performs no navigation.
 */
export function useOpenProjectEvaluatorGallery() {
  const context = useContext(ProjectEvaluatorContext);
  invariant(
    context,
    "useOpenProjectEvaluatorGallery must be used within the evaluators page"
  );
  return context;
}
