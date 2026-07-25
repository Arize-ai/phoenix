import { act, useState } from "react";
import type { Key } from "react-aria-components";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { userEvent } from "storybook/test";

import { SegmentedControl } from "../SegmentedControl";
import { SegmentedControlItem } from "../SegmentedControlItem";

function ControlledSegmentedControl() {
  const [selectedKey, setSelectedKey] = useState<Key>("first");
  return (
    <SegmentedControl
      aria-label="View"
      selectedKey={selectedKey}
      onSelectionChange={setSelectedKey}
    >
      <SegmentedControlItem id="first">First</SegmentedControlItem>
      <SegmentedControlItem id="second">Second</SegmentedControlItem>
    </SegmentedControl>
  );
}

function getRect({
  left,
  top,
  width,
}: {
  left: number;
  top: number;
  width: number;
}): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    width,
    height: 30,
    right: left + width,
    bottom: top + 30,
    toJSON: () => ({}),
  };
}

describe("SegmentedControl", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 1);
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
      function (this: Element) {
        if (this.classList.contains("segmented-control__thumb")) {
          return this.parentElement?.textContent === "Second"
            ? getRect({ left: 60, top: 108, width: 70 })
            : getRect({ left: 0, top: 100, width: 40 });
        }
        return getRect({ left: 0, top: 0, width: 0 });
      }
    );
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it("discards vertical viewport movement from the thumb transition", async () => {
    act(() => root.render(<ControlledSegmentedControl />));
    const user = userEvent.setup();
    const secondItem = container.querySelector<HTMLButtonElement>(
      ".segmented-control__item:nth-of-type(2)"
    );

    expect(secondItem).not.toBeNull();
    await act(async () => user.click(secondItem!));

    const selectedThumb = container.querySelector<HTMLElement>(
      ".segmented-control__item[data-selected] .segmented-control__thumb"
    );
    expect(selectedThumb).not.toBeNull();
    expect(selectedThumb?.style.translate).toBe("-60px 0px");
  });
});
