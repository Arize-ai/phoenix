import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DetailsPanelHeader } from "../DetailsPanel";

describe("DetailsPanelHeader", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("places the compact panel toggle before pagination", () => {
    act(() => {
      root.render(
        <DetailsPanelHeader
          close={() => {}}
          closeLabel="Close trace details"
          isCollapsed
          onCollapsedChange={() => {}}
          pagination={
            <>
              <button aria-label="Previous trace" />
              <button aria-label="Next trace" />
            </>
          }
        />
      );
    });

    const buttonLabels = Array.from(container.querySelectorAll("button")).map(
      (button) => button.getAttribute("aria-label")
    );
    const closeRowButtonLabels = Array.from(
      container.querySelectorAll(".details-panel-header__close-row > button")
    ).map((button) => button.getAttribute("aria-label"));

    expect(buttonLabels).toEqual([
      "Close trace details",
      "Expand trace navigation",
      "Previous trace",
      "Next trace",
    ]);
    expect(closeRowButtonLabels).toEqual(["Close trace details"]);
  });
});
