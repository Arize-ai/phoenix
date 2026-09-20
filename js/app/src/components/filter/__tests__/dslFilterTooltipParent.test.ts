import { afterEach, describe, expect, it } from "vitest";

import { findDSLFilterTooltipParent } from "../dslFilterTooltipParent";

describe("findDSLFilterTooltipParent", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("uses the application viewport for page-level filters", () => {
    const application = document.createElement("div");
    application.dataset.overlayContainer = "application";
    const editor = document.createElement("div");
    application.appendChild(editor);
    document.body.appendChild(application);

    expect(findDSLFilterTooltipParent(editor)).toBe(application);
    expect(application.classList.contains("dsl-filter-tooltip-root")).toBe(
      true
    );
  });

  it("prefers the nearest modal overlay", () => {
    const application = document.createElement("div");
    application.dataset.overlayContainer = "application";
    const modal = document.createElement("div");
    modal.dataset.overlayContainer = "modal";
    const editor = document.createElement("div");
    modal.appendChild(editor);
    application.appendChild(modal);
    document.body.appendChild(application);

    expect(findDSLFilterTooltipParent(editor)).toBe(modal);
    expect(modal.classList.contains("dsl-filter-tooltip-root")).toBe(true);
    expect(application.classList.contains("dsl-filter-tooltip-root")).toBe(
      false
    );
  });
});
