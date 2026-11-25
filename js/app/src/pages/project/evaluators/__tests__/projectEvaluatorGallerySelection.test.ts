import {
  type GalleryItem,
  getGalleryItemCreationPath,
  getGalleryItemKey,
  getGallerySelectionFromKeys,
  NO_GALLERY_SELECTION,
  resolveGallerySelection,
} from "@phoenix/pages/project/evaluators/projectEvaluatorGallerySelection";
import type { ProjectEvaluatorCreationPaths } from "@phoenix/pages/project/evaluators/projectEvaluatorPaths";

const item: GalleryItem = {
  kind: "custom",
  evaluator: {
    __typename: "LLMEvaluator",
    id: "LLMEvaluator:1",
    name: "correctness",
    description: null,
  },
};
const itemsByKey = new Map([[getGalleryItemKey(item), item]]);

describe("gallery selection", () => {
  it("starts empty, selects a clicked card, and clears on an empty set", () => {
    expect(
      resolveGallerySelection(NO_GALLERY_SELECTION, itemsByKey)
    ).toBeUndefined();

    const clicked = getGallerySelectionFromKeys(
      new Set([getGalleryItemKey(item)]),
      itemsByKey
    );
    expect(resolveGallerySelection(clicked, itemsByKey)).toBe(item);

    expect(getGallerySelectionFromKeys(new Set(), itemsByKey)).toBe(
      NO_GALLERY_SELECTION
    );
  });
});

describe("getGalleryItemCreationPath", () => {
  const creationPaths: ProjectEvaluatorCreationPaths = {
    newLlm: "llm",
    newCode: "code",
    newDecision: "decision",
    newLlmFromTemplate: (name) => `template/${name}`,
    copyLlm: (id) => `copy-llm/${id}`,
    copyCode: (id) => `copy-code/${id}`,
    attach: (id) => `attach/${id}`,
  };
  it.each([
    {
      name: "a template opens the LLM form from it",
      item: { kind: "template" as const, template: { name: "hallucination" } },
      path: "template/hallucination",
    },
    {
      name: "a custom LLM evaluator opens a copy",
      item: {
        kind: "custom" as const,
        evaluator: { __typename: "LLMEvaluator" as const, id: "L1" },
      },
      path: "copy-llm/L1",
    },
    {
      name: "a custom code evaluator opens its attach form",
      item: {
        kind: "custom" as const,
        evaluator: { __typename: "CodeEvaluator" as const, id: "C1" },
      },
      path: "attach/C1",
    },
    {
      name: "a custom decision evaluator opens its attach form",
      item: {
        kind: "custom" as const,
        evaluator: { __typename: "DecisionEvaluator" as const, id: "D1" },
      },
      path: "attach/D1",
    },
  ])("$name", ({ item: galleryItem, path }) => {
    expect(
      getGalleryItemCreationPath({ item: galleryItem, creationPaths })
    ).toBe(path);
  });
});
