import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";

import { SegmentedControl } from "../SegmentedControl";
import { SegmentedControlItem } from "../SegmentedControlItem";

describe("SegmentedControl", () => {
  let container: HTMLDivElement;
  let root: Root;
  let animationFrameCallbacks: FrameRequestCallback[];

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    animationFrameCallbacks = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      animationFrameCallbacks.push(callback);
      return animationFrameCallbacks.length;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  function flushAnimationFrames() {
    const callbacks = animationFrameCallbacks.splice(0);
    act(() => {
      callbacks.forEach((callback) => callback(performance.now()));
    });
  }

  it("keeps the selection thumb on its track when the page reflows", () => {
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
      function (this: Element) {
        const item = this.closest(".segmented-control__item");
        const isTableItem = item?.textContent === "Table";
        return DOMRect.fromRect({
          // The control itself moved 30px between the outgoing and incoming
          // measurements, in addition to the 60px between its two items.
          x: isTableItem ? 10 : 100,
          y: isTableItem ? 20 : 220,
          width: isTableItem ? 50 : 60,
          height: 24,
        });
      }
    );
    vi.spyOn(HTMLElement.prototype, "offsetLeft", "get").mockImplementation(
      function (this: HTMLElement) {
        return this.textContent === "Table" ? 0 : 60;
      }
    );

    act(() => {
      root.render(
        <SegmentedControl aria-label="View" defaultSelectedKey="table">
          <SegmentedControlItem id="table">Table</SegmentedControlItem>
          <SegmentedControlItem id="json">JSON</SegmentedControlItem>
        </SegmentedControl>
      );
    });
    flushAnimationFrames();

    const jsonItem = Array.from(
      container.querySelectorAll<HTMLButtonElement>(".segmented-control__item")
    ).find((item) => item.textContent === "JSON");
    expect(jsonItem).toBeDefined();

    act(() => jsonItem?.click());

    const selectedThumb = container.querySelector<HTMLElement>(
      ".segmented-control__item[data-selected] .segmented-control__thumb"
    );
    expect(selectedThumb?.style.translate).toBe("-60px 0px");
  });
});
