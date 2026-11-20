import type { Selection } from "react-aria-components";

import type { ProjectEvaluatorCreationPaths } from "@phoenix/pages/project/evaluators/projectEvaluatorPaths";
import type { ProjectEvaluatorTemplate } from "@phoenix/pages/project/evaluators/projectEvaluatorTemplates";

export type CustomEvaluator = {
  readonly __typename: "LLMEvaluator" | "CodeEvaluator" | "DecisionEvaluator";
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
};

export type CustomEvaluatorKind = "LLM" | "CODE" | "DECISION";

const CUSTOM_EVALUATOR_KINDS = {
  LLMEvaluator: "LLM",
  CodeEvaluator: "CODE",
  DecisionEvaluator: "DECISION",
} satisfies Record<CustomEvaluator["__typename"], CustomEvaluatorKind>;

export const getCustomEvaluatorKind = (
  evaluator: Pick<CustomEvaluator, "__typename">
): CustomEvaluatorKind => CUSTOM_EVALUATOR_KINDS[evaluator.__typename];

/** Whether the gallery offers an evaluator: built-in ones it does not. */
export function isGalleryCustomEvaluator<
  TEvaluator extends { readonly __typename: string },
>(evaluator: TEvaluator): evaluator is TEvaluator & CustomEvaluator {
  return Object.hasOwn(CUSTOM_EVALUATOR_KINDS, evaluator.__typename);
}

export type GalleryItem =
  | { kind: "custom"; evaluator: CustomEvaluator }
  | { kind: "template"; template: ProjectEvaluatorTemplate };

/** The card the gallery shows details for, if any. */
export type GallerySelection =
  | { kind: "none" }
  | { kind: "template"; templateName: string }
  | { kind: "evaluator"; evaluatorId: string };

export const NO_GALLERY_SELECTION: GallerySelection = { kind: "none" };

export const getCustomEvaluatorItemKey = (id: string) => `custom:${id}`;
export const getTemplateItemKey = (name: string) => `template:${name}`;

export function getGalleryItemKey(item: GalleryItem): string {
  return item.kind === "custom"
    ? getCustomEvaluatorItemKey(item.evaluator.id)
    : getTemplateItemKey(item.template.name);
}

export function getGalleryItemSelection(item: GalleryItem): GallerySelection {
  return item.kind === "custom"
    ? { kind: "evaluator", evaluatorId: item.evaluator.id }
    : { kind: "template", templateName: item.template.name };
}

/**
 * The selection a change to the card list's selected keys asks for. An empty
 * set, sent when the selected card is clicked again, clears it.
 */
export function getGallerySelectionFromKeys(
  keys: Selection,
  itemsByKey: ReadonlyMap<string, GalleryItem>
): GallerySelection {
  const key = keys === "all" ? undefined : keys.values().next().value;
  const item = typeof key === "string" ? itemsByKey.get(key) : undefined;
  return item ? getGalleryItemSelection(item) : NO_GALLERY_SELECTION;
}

export function resolveGallerySelection(
  selection: GallerySelection,
  itemsByKey: ReadonlyMap<string, GalleryItem>
): GalleryItem | undefined {
  if (selection.kind === "none") return undefined;
  return itemsByKey.get(
    selection.kind === "evaluator"
      ? getCustomEvaluatorItemKey(selection.evaluatorId)
      : getTemplateItemKey(selection.templateName)
  );
}

/**
 * Where pressing a gallery card goes: a template opens the LLM form from it,
 * a custom LLM evaluator a copy of it, and a code or decision one its attach
 * form.
 */
export function getGalleryItemCreationPath({
  item,
  creationPaths,
}: {
  item:
    | { kind: "template"; template: Pick<ProjectEvaluatorTemplate, "name"> }
    | {
        kind: "custom";
        evaluator: Pick<CustomEvaluator, "__typename" | "id">;
      };
  creationPaths: ProjectEvaluatorCreationPaths;
}): string {
  if (item.kind === "template") {
    return creationPaths.newLlmFromTemplate(item.template.name);
  }
  return getCustomEvaluatorKind(item.evaluator) === "LLM"
    ? creationPaths.copyLlm(item.evaluator.id)
    : creationPaths.attach(item.evaluator.id);
}
