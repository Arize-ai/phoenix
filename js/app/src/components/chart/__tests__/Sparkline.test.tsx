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

  /** The rendered stroked paths (lines, bridges, dots), in document order. */
  const getStrokes = () => [
    ...container.querySelectorAll<SVGPathElement>('path[fill="none"]'),
  ];

  /**
   * The stroked paths' `d` strings in document order: the marks, then the
   * end-of-series dot on the last value.
   */
  const getPaths = () => getStrokes().map((path) => path.getAttribute("d"));

  /** The stroke widths of the stroked paths, in document order. */
  const getStrokeWidths = () =>
    getStrokes().map((path) => Number(path.getAttribute("stroke-width")));

  /** The shaded regions under the line, in document order. */
  const getFills = () => [
    ...container.querySelectorAll<SVGPathElement>('path[stroke="none"]'),
  ];

  const getFillPaths = () => getFills().map((path) => path.getAttribute("d"));

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
    const bridge = getStrokes()[1];
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

  it("shades the region under a run down to the baseline with one shared gradient", () => {
    render([0, 0.5, 1]);
    expect(getFillPaths()).toEqual([
      "M 0.00 18.00 L 32.00 10.00 L 64.00 2.00 L 64.00 20.00 L 0.00 20.00 Z",
    ]);
    const gradient = container.querySelector("linearGradient");
    expect(gradient).not.toBeNull();
    // Drawn in drawing coordinates from the series' highest point to the
    // baseline, so every shaded region fades on the same vertical scale
    expect(gradient?.getAttribute("gradientUnits")).toBe("userSpaceOnUse");
    expect(gradient?.getAttribute("y1")).toBe("2.00");
    expect(gradient?.getAttribute("y2")).toBe("20");
    const stops = [...(gradient?.querySelectorAll("stop") ?? [])].map((stop) =>
      stop.getAttribute("stop-opacity")
    );
    expect(stops).toEqual(["0.3", "0"]);
    for (const fill of getFills()) {
      expect(fill.getAttribute("fill")).toBe(
        `url(#${gradient?.getAttribute("id")})`
      );
    }
  });

  it("shades a bridged gap more faintly than the runs it joins", () => {
    render([0, 1, null, 1, 0]);
    expect(getFillPaths()).toEqual([
      "M 0.00 18.00 L 16.00 2.00 L 16.00 20.00 L 0.00 20.00 Z",
      "M 16.00 2.00 L 48.00 2.00 L 48.00 20.00 L 16.00 20.00 Z",
      "M 48.00 2.00 L 64.00 18.00 L 64.00 20.00 L 48.00 20.00 Z",
    ]);
    expect(getFills().map((fill) => fill.getAttribute("fill-opacity"))).toEqual(
      [null, "0.5", null]
    );
  });

  it("stands a gap-isolated value on a column one bin wide", () => {
    render([null, 0.5, null, null, 1, null]);
    // Each value's column spans its own bin, half a bin to either side
    expect(getFillPaths()).toEqual([
      "M 6.40 18.00 L 19.20 18.00 L 19.20 20.00 L 6.40 20.00 Z",
      "M 44.80 2.00 L 57.60 2.00 L 57.60 20.00 L 44.80 20.00 Z",
    ]);
  });

  it("clips an edge value's column to the drawing box", () => {
    render([0.5, null, null, 1]);
    expect(getFillPaths()).toEqual([
      "M 0.00 18.00 L 10.67 18.00 L 10.67 20.00 L 0.00 20.00 Z",
      "M 53.33 2.00 L 64.00 2.00 L 64.00 20.00 L 53.33 20.00 Z",
    ]);
  });

  it("widens an isolated merged point's column to the bins it covers", () => {
    render([1, 1, null, null, null, null, 0, 0], { maxWidth: 16 });
    // Each end pair merges into one point covering two of eight bins
    expect(getFillPaths()).toEqual([
      "M 0.00 2.00 L 13.71 2.00 L 13.71 20.00 L 0.00 20.00 Z",
      "M 50.29 18.00 L 64.00 18.00 L 64.00 20.00 L 50.29 20.00 Z",
    ]);
  });

  it("shades a flat series from its midline", () => {
    render([0.7, 0.7, 0.7]);
    expect(getFillPaths()).toEqual([
      "M 0.00 10.00 L 32.00 10.00 L 64.00 10.00 L 64.00 20.00 L 0.00 20.00 Z",
    ]);
    expect(container.querySelector("linearGradient")?.getAttribute("y1")).toBe(
      "10.00"
    );
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
