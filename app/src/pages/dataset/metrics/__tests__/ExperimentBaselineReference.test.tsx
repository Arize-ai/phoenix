import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import type * as RechartsModule from "recharts";
import type { XAxisTickContentProps } from "recharts";

import {
  BASELINE_COLOR,
  BASELINE_STROKE_DASHARRAY,
  ExperimentBaselineDistributionSeparator,
  ExperimentBaselineValueLine,
  makeExperimentAxisTick,
} from "../ExperimentBaselineReference";

vi.mock("recharts", async (importOriginal) => {
  const recharts = await importOriginal<typeof RechartsModule>();
  return {
    ...recharts,
    ReferenceLine: ({
      stroke,
      strokeDasharray,
      x,
    }: {
      stroke?: string;
      strokeDasharray?: string | number;
      x?: string | number;
    }) => (
      <div
        data-axis={x == null ? "y" : "x"}
        data-stroke={stroke}
        data-stroke-dasharray={strokeDasharray}
      />
    ),
  };
});

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

  it("uses a dashed purple horizontal score reference", () => {
    act(() => root.render(<ExperimentBaselineValueLine value={0.5} />));
    const line = container.querySelector('[data-axis="y"]');

    expect(line?.getAttribute("data-stroke")).toBe(BASELINE_COLOR);
    expect(line?.getAttribute("data-stroke")).toBe(
      "var(--global-color-purple-500)"
    );
    expect(line?.getAttribute("data-stroke-dasharray")).toBe(
      BASELINE_STROKE_DASHARRAY
    );
  });

  it("uses a solid neutral separator after the baseline bar", () => {
    act(() =>
      root.render(<ExperimentBaselineDistributionSeparator value={1} />)
    );
    const separator = container.querySelector('[data-axis="x"]');

    expect(separator?.getAttribute("data-stroke")).toBe(
      "var(--chart-axis-stroke-color)"
    );
    expect(separator?.hasAttribute("data-stroke-dasharray")).toBe(false);
  });

  it("labels the baseline tick by role instead of sequence number", () => {
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

    expect(labels).toEqual(["baseline", "#2"]);
  });
});
