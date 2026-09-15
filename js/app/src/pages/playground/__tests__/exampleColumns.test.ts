import { describe, expect, it } from "vitest";

import {
  getDisplayedMetadata,
  getExampleColumnVisibility,
  hasDisplayableMetadata,
} from "../exampleColumns";

const EXPECTED_OUTPUTS = {
  judge: [{ label: "pass", annotator_kind: "HUMAN" }],
};

const HIDING = { hideAnnotations: true };
const SHOWING = { hideAnnotations: false };

describe("getDisplayedMetadata", () => {
  it("leaves the annotations key out and says so", () => {
    expect(
      getDisplayedMetadata(
        { customer: "acme", annotations: EXPECTED_OUTPUTS },
        HIDING
      )
    ).toEqual({ value: { customer: "acme" }, isHidingAnnotations: true });
  });

  it("passes metadata without annotations through untouched", () => {
    const metadata = { customer: "acme", tags: ["a"] };

    expect(getDisplayedMetadata(metadata, HIDING)).toEqual({
      value: metadata,
      isHidingAnnotations: false,
    });
    expect(getDisplayedMetadata(null, HIDING)).toEqual({
      value: null,
      isHidingAnnotations: false,
    });
  });

  it("shows the whole value once the setting is off", () => {
    const metadata = { customer: "acme", annotations: EXPECTED_OUTPUTS };

    expect(getDisplayedMetadata(metadata, SHOWING)).toEqual({
      value: metadata,
      isHidingAnnotations: false,
    });
  });
});

describe("hasDisplayableMetadata", () => {
  it("counts only keys besides annotations while they are hidden", () => {
    expect(hasDisplayableMetadata({ customer: "acme" }, HIDING)).toBe(true);
    expect(
      hasDisplayableMetadata(
        { customer: "acme", annotations: EXPECTED_OUTPUTS },
        HIDING
      )
    ).toBe(true);
    expect(
      hasDisplayableMetadata({ annotations: EXPECTED_OUTPUTS }, HIDING)
    ).toBe(false);
    expect(hasDisplayableMetadata({}, HIDING)).toBe(false);
    expect(hasDisplayableMetadata(null, HIDING)).toBe(false);
    expect(hasDisplayableMetadata("acme", HIDING)).toBe(false);
  });

  it("counts annotations once they show", () => {
    expect(
      hasDisplayableMetadata({ annotations: EXPECTED_OUTPUTS }, SHOWING)
    ).toBe(true);
    expect(hasDisplayableMetadata({}, SHOWING)).toBe(false);
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
