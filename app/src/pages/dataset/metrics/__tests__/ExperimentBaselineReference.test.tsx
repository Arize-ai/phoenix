import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import type { XAxisTickContentProps } from "recharts";

import { makeExperimentAxisTick } from "../ExperimentBaselineReference";

describe("experiment baseline references", () => {
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

  it("preserves the baseline sequence number while identifying its role", () => {
    const Tick = makeExperimentAxisTick(1);
    const tickProps: Omit<XAxisTickContentProps, "payload"> = {
      angle: 0,
      fill: undefined,
      index: 0,
      stroke: "none",
      textAnchor: "middle",
      tickFormatter: undefined,
      verticalAnchor: "start",
      visibleTicksCount: 2,
      x: 0,
      y: 0,
      orientation: "bottom",
      padding: undefined,
    };
    act(() =>
      root.render(
        <svg>
          <Tick
            {...tickProps}
            payload={{ value: 1, coordinate: 0, index: 0 }}
          />
          <Tick
            {...tickProps}
            payload={{ value: 2, coordinate: 1, index: 1 }}
          />
        </svg>
      )
    );
    const labels = Array.from(container.querySelectorAll("text")).map(
      (text) => text.textContent
    );

    expect(labels).toEqual(["#1 (baseline)", "#2"]);
  });
});
