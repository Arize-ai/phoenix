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
