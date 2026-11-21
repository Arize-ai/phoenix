import {
  type GalleryItem,
  getGalleryItemKey,
  getGallerySelectionFromKeys,
  NO_GALLERY_SELECTION,
  resolveGallerySelection,
} from "@phoenix/pages/project/evaluators/projectEvaluatorGallerySelection";

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
