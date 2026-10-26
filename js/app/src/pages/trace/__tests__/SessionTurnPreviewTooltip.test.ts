import { afterEach, describe, expect, it, vi } from "vitest";

import { isElementInScrollView } from "../SessionTurnPreviewTooltip";

function stubRect(element: Element, top: number, bottom: number) {
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue(
    DOMRect.fromRect({ x: 0, y: top, width: 100, height: bottom - top })
  );
}

describe("isElementInScrollView", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("counts a row as visible when any of it is within its list", () => {
    const list = document.createElement("div");
    list.style.overflow = "auto";
    const row = list.appendChild(document.createElement("div"));
    document.body.appendChild(list);
    // Without layout, as in jsdom, everything counts as visible
    expect(isElementInScrollView(row)).toBe(true);

    stubRect(list, 100, 400);
    const visibilityByRowSpan = [
      [150, 200, true],
      [80, 120, true],
      [20, 70, false],
      [450, 500, false],
    ] as const;
    for (const [top, bottom, isVisible] of visibilityByRowSpan) {
      stubRect(row, top, bottom);
      expect(isElementInScrollView(row)).toBe(isVisible);
    }
  });
});
