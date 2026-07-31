import { act, useState } from "react";
import type { Key } from "react-aria-components";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";

import { SegmentedControl } from "../SegmentedControl";
import { SegmentedControlItem } from "../SegmentedControlItem";

describe("SegmentedControl", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    // Track-local geometry: Table at 0 (width 50), JSON at 60 (width 70).
    vi.spyOn(HTMLElement.prototype, "offsetLeft", "get").mockImplementation(
      function (this: HTMLElement) {
        return this.textContent === "JSON" ? 60 : 0;
      }
    );
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(
      function (this: HTMLElement) {
        return this.textContent === "JSON" ? 70 : 50;
      }
    );
    // Viewport rectangles drift on every measurement, as they do when content
    // loads and the page reflows mid-interaction. Nothing about the thumb may
    // depend on them.
    let reflowDrift = 0;
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
      () => {
        reflowDrift += 137;
        return DOMRect.fromRect({
          x: reflowDrift,
          y: reflowDrift * 2,
          width: 50,
          height: 24,
        });
      }
    );
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it("keeps the thumb's geometry in the track's own coordinate space", async () => {
    act(() => {
      root.render(
        <SegmentedControl aria-label="View" defaultSelectedKey="table">
          <SegmentedControlItem id="table">Table</SegmentedControlItem>
          <SegmentedControlItem id="json">JSON</SegmentedControlItem>
        </SegmentedControl>
      );
    });

    const track = container.querySelector<HTMLElement>(".segmented-control");
    expect(track).not.toBeNull();
    const thumbs = track!.querySelectorAll<HTMLElement>(
      ".segmented-control__thumb"
    );
    expect(thumbs).toHaveLength(1);
    const thumb = thumbs[0];
    // The thumb belongs to the track, not to any item, so its containing
    // block — and every coordinate it can hold — is the track itself.
    expect(thumb.parentElement).toBe(track);

    expect(thumb.style.left).toBe("calc(0px - var(--global-border-size-thin))");
    expect(thumb.style.width).toBe(
      "calc(50px + 2 * var(--global-border-size-thin))"
    );
    expect(thumb.style.visibility).toBe("visible");

    const jsonItem = Array.from(
      container.querySelectorAll<HTMLButtonElement>(".segmented-control__item")
    ).find((item) => item.textContent === "JSON");
    expect(jsonItem).toBeDefined();
    await act(async () => jsonItem!.click());

    expect(thumb.style.left).toBe(
      "calc(60px - var(--global-border-size-thin))"
    );
    expect(thumb.style.width).toBe(
      "calc(70px + 2 * var(--global-border-size-thin))"
    );
    // No vertical degree of freedom exists for reflow to corrupt: nothing
    // writes the vertical axis or a transform, ever.
    expect(thumb.style.top).toBe("");
    expect(thumb.style.translate).toBe("");
    expect(thumb.style.transform).toBe("");
    // The suppression used for instant repositioning must not leak past it.
    expect(thumb.style.transitionProperty).toBe("");
  });

  it("keeps the clicked control at the same scroll-container offset after reflow", async () => {
    // The linked content's reflow moves the control from 200 to 260 within
    // its scroll container (top 50) when the selection is applied.
    let controlTop = 200;
    let controlElement: HTMLElement | null = null;
    let scrollElement: HTMLElement | null = null;

    function Harness() {
      const [mode, setMode] = useState<Key>("table");
      return (
        <div data-scroll-container style={{ overflowY: "auto" }}>
          <SegmentedControl
            aria-label="View"
            selectedKey={mode}
            onSelectionChange={(key) => {
              controlTop = 260;
              setMode(key);
            }}
          >
            <SegmentedControlItem id="table">Table</SegmentedControlItem>
            <SegmentedControlItem id="json">JSON</SegmentedControlItem>
          </SegmentedControl>
        </div>
      );
    }

    act(() => root.render(<Harness />));

    scrollElement = container.querySelector<HTMLElement>(
      "[data-scroll-container]"
    );
    controlElement = container.querySelector<HTMLElement>(".segmented-control");
    expect(scrollElement).not.toBeNull();
    expect(controlElement).not.toBeNull();

    scrollElement!.scrollTop = 100;
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
      function (this: Element) {
        if (this === scrollElement) {
          return DOMRect.fromRect({ y: 50 });
        }
        if (this === controlElement) {
          return DOMRect.fromRect({ y: controlTop });
        }
        return DOMRect.fromRect();
      }
    );

    const jsonItem = Array.from(
      container.querySelectorAll<HTMLButtonElement>(".segmented-control__item")
    ).find((item) => item.textContent === "JSON");
    await act(async () => jsonItem!.click());

    // The control moved down 60px, so the container scrolls down 60px to keep
    // it under the pointer.
    expect(scrollElement!.scrollTop).toBe(160);
  });

  it("returns the thumb to its hidden resting state when unmounted mid-flight", async () => {
    act(() => {
      root.render(
        <SegmentedControl aria-label="View" defaultSelectedKey="table">
          <SegmentedControlItem id="table">Table</SegmentedControlItem>
          <SegmentedControlItem id="json">JSON</SegmentedControlItem>
        </SegmentedControl>
      );
    });
    act(() => root.unmount());
    // The unregister microtask must tolerate the whole control being gone.
    await act(async () => {});
    expect(container.querySelector(".segmented-control__thumb")).toBeNull();
  });
});
