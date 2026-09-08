import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Sparkline, type SparklineProps } from "@phoenix/components/chart";

describe("Sparkline", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const render = (
    values: (number | null)[],
    props: Partial<Omit<SparklineProps, "values" | "color">> = {}
  ) => {
    act(() => {
      root.render(
        <Sparkline values={values} color="currentColor" {...props} />
      );
    });
  };

  /**
   * All rendered path `d` strings in document order: the marks, then the
   * end-of-series dot on the last value.
   */
  const getPaths = () =>
    [...container.querySelectorAll("path")].map((path) =>
      path.getAttribute("d")
    );

  /** The stroke widths of the rendered paths, in document order. */
  const getStrokeWidths = () =>
    [...container.querySelectorAll("path")].map((path) =>
      Number(path.getAttribute("stroke-width"))
    );

  it("draws one line through the values, spanning the full width", () => {
    render([0, 0.5, 1]);
    // Three points: min at the bottom, max at the top, full width covered,
    // and the last value marked
    expect(getPaths()).toEqual([
      "M 0.00 18.00 L 32.00 10.00 L 64.00 2.00",
      "M 64.00 2.00 l 0.01 0",
    ]);
  });

  it("bridges a single empty bin faintly, keeping every bin's x position", () => {
    render([0, 1, null, 1, 0]);
    // The empty middle bin still occupies x=32, so the runs around it keep
    // their positions on the shared axis; a faint bridge spans the lapse.
    expect(getPaths()).toEqual([
      "M 0.00 18.00 L 16.00 2.00",
      "M 16.00 2.00 L 48.00 2.00",
      "M 48.00 2.00 L 64.00 18.00",
      "M 64.00 18.00 l 0.01 0",
    ]);
    const bridge = container.querySelectorAll("path")[1];
    expect(bridge.getAttribute("stroke-opacity")).toBe("0.4");
  });

  it("breaks the line at a gap wider than one bin", () => {
    render([0, 1, null, null, 1, 0]);
    expect(getPaths()).toEqual([
      "M 0.00 18.00 L 12.80 2.00",
      "M 51.20 2.00 L 64.00 18.00",
      "M 64.00 18.00 l 0.01 0",
    ]);
  });

  it("draws a gap-isolated value as a dot of the line's weight", () => {
    render([0.2, 0.4, null, 0.9]);
    expect(getPaths()).toEqual([
      "M 0.00 18.00 L 21.33 13.43",
      // The single-bin gap is bridged to the isolated value
      "M 21.33 13.43 L 64.00 2.00",
      "M 64.00 2.00 l 0.01 0",
      "M 64.00 2.00 l 0.01 0",
    ]);
    // Line, bridge, isolated dot, end dot
    expect(getStrokeWidths()).toEqual([1.5, 1.5, 2.5, 3]);
  });

  it("keeps values in their bins when the series starts or ends empty", () => {
    render([null, 0.5, null, null, 1, null]);
    // Two values separated by a wide gap: two dots at their own bin
    // positions, not a line pinned to the edges.
    expect(getPaths()).toEqual([
      "M 12.80 18.00 l 0.01 0",
      "M 51.20 2.00 l 0.01 0",
      "M 51.20 2.00 l 0.01 0",
    ]);
  });

  it("draws a flat series as a midline", () => {
    render([0.7, 0.7, 0.7]);
    expect(getPaths()).toEqual([
      "M 0.00 10.00 L 32.00 10.00 L 64.00 10.00",
      "M 64.00 10.00 l 0.01 0",
    ]);
  });

  it("draws a single value as a dot at its bin position", () => {
    render([null, 0.5, null]);
    expect(getPaths()).toEqual([
      "M 32.00 10.00 l 0.01 0",
      "M 32.00 10.00 l 0.01 0",
    ]);
  });

  it("renders nothing when every value is null", () => {
    render([null, null]);
    expect(container.querySelector("svg")).toBeNull();
  });

  it("widens a narrow value range to the minimum, centered on the data", () => {
    render([0.6, 0.7], { minRange: 0.2 });
    // Data spans 0.1; the axis spans 0.2, from 0.55 to 0.75, so the line
    // climbs half the height instead of all of it
    expect(getPaths()).toEqual([
      "M 0.00 14.00 L 64.00 6.00",
      "M 64.00 6.00 l 0.01 0",
    ]);
  });

  it("lets data wider than the minimum range set the axis", () => {
    render([0, 1], { minRange: 0.2 });
    expect(getPaths()).toEqual([
      "M 0.00 18.00 L 64.00 2.00",
      "M 64.00 2.00 l 0.01 0",
    ]);
  });

  it("merges adjacent bins into weighted means when the width can't resolve them", () => {
    // 16px resolves 4 points, so 8 bins merge in pairs. The first pair's
    // mean is pulled toward its heavier value; each merged point sits over
    // the center of the bins it covers.
    render([0, 1, 0, 1, 0, 0, 1, 1], {
      maxWidth: 16,
      weights: [1, 3, 1, 1, 1, 1, 1, 1],
    });
    expect(getPaths()).toEqual([
      "M 4.57 6.00 L 22.86 10.00 L 41.14 18.00 L 59.43 2.00",
      "M 59.43 2.00 l 0.01 0",
    ]);
  });

  it("leaves a merged bin empty when none of its bins carry a value", () => {
    render([1, 1, null, null, null, null, 0, 0], { maxWidth: 16 });
    // Two empty merged bins in the middle: too wide a gap to bridge
    expect(getPaths()).toEqual([
      "M 4.57 2.00 l 0.01 0",
      "M 59.43 18.00 l 0.01 0",
      "M 59.43 18.00 l 0.01 0",
    ]);
  });
});
