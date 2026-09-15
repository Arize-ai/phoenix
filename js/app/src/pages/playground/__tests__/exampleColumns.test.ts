import { describe, expect, it } from "vitest";

import {
  getDisplayedMetadata,
  getExampleColumnVisibility,
  hasDisplayableMetadata,
} from "../exampleColumns";

const EXPECTED_OUTPUTS = {
  judge: [{ label: "pass", annotator_kind: "HUMAN" }],
};

describe("getDisplayedMetadata", () => {
  it("leaves the annotations key out and says so", () => {
    expect(
      getDisplayedMetadata({
        customer: "acme",
        annotations: EXPECTED_OUTPUTS,
      })
    ).toEqual({ value: { customer: "acme" }, isHidingAnnotations: true });
  });

  it("passes metadata without annotations through untouched", () => {
    const metadata = { customer: "acme", tags: ["a"] };

    expect(getDisplayedMetadata(metadata)).toEqual({
      value: metadata,
      isHidingAnnotations: false,
    });
    expect(getDisplayedMetadata(null)).toEqual({
      value: null,
      isHidingAnnotations: false,
    });
  });
});

describe("hasDisplayableMetadata", () => {
  it("counts only keys besides annotations", () => {
    expect(hasDisplayableMetadata({ customer: "acme" })).toBe(true);
    expect(
      hasDisplayableMetadata({
        customer: "acme",
        annotations: EXPECTED_OUTPUTS,
      })
    ).toBe(true);
    expect(hasDisplayableMetadata({ annotations: EXPECTED_OUTPUTS })).toBe(
      false
    );
    expect(hasDisplayableMetadata({})).toBe(false);
    expect(hasDisplayableMetadata(null)).toBe(false);
    expect(hasDisplayableMetadata("acme")).toBe(false);
  });
});

describe("getExampleColumnVisibility", () => {
  it("hides metadata until a loaded example has some", () => {
    expect(
      getExampleColumnVisibility({ hasMetadata: false, storedVisibility: {} })
    ).toEqual({ metadata: false });
    expect(
      getExampleColumnVisibility({ hasMetadata: true, storedVisibility: {} })
    ).toEqual({ metadata: true });
  });

  it("lets a stored choice win in both directions", () => {
    expect(
      getExampleColumnVisibility({
        hasMetadata: false,
        storedVisibility: { metadata: true },
      })
    ).toEqual({ metadata: true });
    expect(
      getExampleColumnVisibility({
        hasMetadata: true,
        storedVisibility: { metadata: false, output: false },
      })
    ).toEqual({ metadata: false, output: false });
  });
});
