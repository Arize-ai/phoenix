import { createContext, useContext } from "react";
import invariant from "tiny-invariant";

/**
 * The card the gallery preselects when it opens. Every field is optional and
 * validated against the loaded gallery, so a stale category, template, or
 * evaluator is harmless and falls back to the first card. `category` is a
 * plain string because it can also carry the gallery's own "other" bucket,
 * which is not an `EvaluatorCategory`.
 */
export type ProjectEvaluatorGallerySelection = {
  category?: string;
  templateName?: string;
  evaluatorId?: string;
};

const OpenProjectEvaluatorGalleryContext = createContext<
  ((selection?: ProjectEvaluatorGallerySelection) => void) | null
>(null);

export const OpenProjectEvaluatorGalleryProvider =
  OpenProjectEvaluatorGalleryContext.Provider;

/**
 * Opens the evaluator gallery over the evaluator list, optionally at a card.
 *
 * The gallery is modal state on the list page rather than a destination, so
 * opening it performs no navigation.
 */
export function useOpenProjectEvaluatorGallery() {
  const openGallery = useContext(OpenProjectEvaluatorGalleryContext);
  invariant(
    openGallery,
    "useOpenProjectEvaluatorGallery must be used within the evaluators page"
  );
  return openGallery;
}
