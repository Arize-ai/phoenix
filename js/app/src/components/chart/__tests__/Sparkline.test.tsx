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

  /** The rendered stroked paths (steps and dots), in document order. */
  const getStrokes = () => [
    ...container.querySelectorAll<SVGPathElement>('path[fill="none"]'),
  ];

  /**
   * The stroked paths' `d` strings in document order: the steps, then the
   * end-of-series dot on the last value.
   */
  const getPaths = () => getStrokes().map((path) => path.getAttribute("d"));

  /** The shaded regions under the steps, in document order. */
  const getFills = () => [
    ...container.querySelectorAll<SVGPathElement>('path[stroke="none"]'),
  ];

  const getFillPaths = () => getFills().map((path) => path.getAttribute("d"));

  /** The coverage strip's cells, in bin order. */
  const getCoverageCells = () => [...container.querySelectorAll("rect")];

  it("draws a flat step across each bin with a riser between neighbors", () => {
    render([0, 0.5, 1]);
    // Bins are 32 wide: the first step is clipped at the left edge, the last
    // at the right, and the last value is marked at its bin center
    expect(getPaths()).toEqual([
      "M 0.00 18.00 L 16.00 18.00 L 16.00 10.00 L 48.00 10.00 L 48.00 2.00 L 64.00 2.00",
      "M 64.00 2.00 l 0.01 0",
    ]);
  });

  it("breaks at a single empty bin, keeping every bin's x position", () => {
    render([0, 1, null, 1, 0]);
    // The empty middle bin still occupies its slot, so the runs around it
    // keep their positions on the shared axis; nothing is drawn across it
    expect(getPaths()).toEqual([
      "M 0.00 18.00 L 8.00 18.00 L 8.00 2.00 L 24.00 2.00",
      "M 40.00 2.00 L 56.00 2.00 L 56.00 18.00 L 64.00 18.00",
      "M 64.00 18.00 l 0.01 0",
    ]);
  });

  it("draws a gap-isolated value as a lone step, not a dot", () => {
    render([0.2, 0.4, null, 0.9]);
    expect(getPaths()).toEqual([
      "M 0.00 18.00 L 10.67 18.00 L 10.67 13.43 L 32.00 13.43",
      "M 53.33 2.00 L 64.00 2.00",
      "M 64.00 2.00 l 0.01 0",
    ]);
  });

  it("keeps values in their bins when the series starts or ends empty", () => {
    render([null, 0.5, null, null, 1, null]);
    expect(getPaths()).toEqual([
      "M 6.40 18.00 L 19.20 18.00",
      "M 44.80 2.00 L 57.60 2.00",
      "M 51.20 2.00 l 0.01 0",
    ]);
  });

  it("draws a flat series as a midline", () => {
    render([0.7, 0.7, 0.7]);
    expect(getPaths()).toEqual([
      "M 0.00 10.00 L 16.00 10.00 L 16.00 10.00 L 48.00 10.00 L 48.00 10.00 L 64.00 10.00",
      "M 64.00 10.00 l 0.01 0",
    ]);
  });

  it("draws a single value as a full-width step", () => {
    render([0.5]);
    expect(getPaths()).toEqual([
      "M 0.00 10.00 L 64.00 10.00",
      "M 32.00 10.00 l 0.01 0",
    ]);
  });

  it("renders nothing when every value is null", () => {
    render([null, null]);
    expect(container.querySelector("svg")).toBeNull();
  });

  it("widens a narrow value range to the minimum, centered on the data", () => {
    render([0.6, 0.7], { minRange: 0.2 });
    // Data spans 0.1; the axis spans 0.2, from 0.55 to 0.75, so the steps
    // climb half the height instead of all of it
    expect(getPaths()).toEqual([
      "M 0.00 14.00 L 32.00 14.00 L 32.00 6.00 L 64.00 6.00",
      "M 64.00 6.00 l 0.01 0",
    ]);
  });

  it("lets data wider than the minimum range set the axis", () => {
    render([0, 1], { minRange: 0.2 });
    expect(getPaths()).toEqual([
      "M 0.00 18.00 L 32.00 18.00 L 32.00 2.00 L 64.00 2.00",
      "M 64.00 2.00 l 0.01 0",
    ]);
  });

  it("merges adjacent bins into weighted means when the width can't resolve them", () => {
    // 16px resolves 4 points, so 8 bins merge in pairs. The first pair's
    // mean is pulled toward its heavier value; each merged step spans the
    // two bins it covers.
    render([0, 1, 0, 1, 0, 0, 1, 1], {
      maxWidth: 16,
      weights: [1, 3, 1, 1, 1, 1, 1, 1],
    });
    expect(getPaths()).toEqual([
      "M 0.00 6.00 L 13.71 6.00 L 13.71 10.00 L 32.00 10.00 L 32.00 18.00 L 50.29 18.00 L 50.29 2.00 L 64.00 2.00",
      "M 59.43 2.00 l 0.01 0",
    ]);
  });

  it("leaves a merged bin empty when none of its bins carry a value", () => {
    render([1, 1, null, null, null, null, 0, 0], { maxWidth: 16 });
    // Two empty merged bins in the middle: a break between two lone steps
    expect(getPaths()).toEqual([
      "M 0.00 2.00 L 13.71 2.00",
      "M 50.29 18.00 L 64.00 18.00",
      "M 59.43 18.00 l 0.01 0",
    ]);
  });

  describe("shading", () => {
    it("shades the region under each run down to the baseline with one shared gradient", () => {
      render([0, 1, null, 0.5]);
      expect(getFillPaths()).toEqual([
        "M 0.00 18.00 L 10.67 18.00 L 10.67 2.00 L 32.00 2.00 L 32.00 20.00 L 0.00 20.00 Z",
        "M 53.33 10.00 L 64.00 10.00 L 64.00 20.00 L 53.33 20.00 Z",
      ]);
      const gradient = container.querySelector("linearGradient");
      expect(gradient).not.toBeNull();
      // Drawn in drawing coordinates from the series' highest step to the
      // baseline, so every shaded region fades on the same vertical scale
      expect(gradient?.getAttribute("gradientUnits")).toBe("userSpaceOnUse");
      expect(gradient?.getAttribute("y1")).toBe("2.00");
      expect(gradient?.getAttribute("y2")).toBe("20");
      const stops = [...(gradient?.querySelectorAll("stop") ?? [])].map(
        (stop) => stop.getAttribute("stop-opacity")
      );
      expect(stops).toEqual(["0.3", "0"]);
      for (const fill of getFills()) {
        expect(fill.getAttribute("fill")).toBe(
          `url(#${gradient?.getAttribute("id")})`
        );
      }
      expect(getCoverageCells()).toEqual([]);
    });

    it("shades a flat series from its midline", () => {
      render([0.7, 0.7]);
      expect(getFillPaths()).toEqual([
        "M 0.00 10.00 L 32.00 10.00 L 32.00 10.00 L 64.00 10.00 L 64.00 20.00 L 0.00 20.00 Z",
      ]);
      expect(
        container.querySelector("linearGradient")?.getAttribute("y1")
      ).toBe("10.00");
    });
  });

  describe("coverage strip", () => {
    it("plots the steps above a strip with one cell per bin, filled where data exists", () => {
      render([0, 1, null, 0.5], { showCoverage: true });
      // The strip (3px) and its gap (2px) leave 15px for the steps
      expect(getPaths()).toEqual([
        "M 0.00 13.00 L 10.67 13.00 L 10.67 2.00 L 32.00 2.00",
        "M 53.33 7.50 L 64.00 7.50",
        "M 64.00 7.50 l 0.01 0",
      ]);
      // No shading: presence lives in the strip
      expect(getFillPaths()).toEqual([]);
      expect(container.querySelector("linearGradient")).toBeNull();
      const cells = getCoverageCells();
      expect(cells.map((cell) => cell.getAttribute("x"))).toEqual([
        "0.40",
        "11.07",
        "32.40",
        "53.73",
      ]);
      expect(cells.map((cell) => cell.getAttribute("y"))).toEqual([
        "17",
        "17",
        "17",
        "17",
      ]);
      expect(cells.map((cell) => cell.getAttribute("fill-opacity"))).toEqual([
        "0.85",
        "0.85",
        "0.15",
        "0.85",
      ]);
    });

    it("gives a merged bin one cell spanning the bins it covers", () => {
      render([1, 1, null, null, null, null, 0, 0], {
        maxWidth: 16,
        showCoverage: true,
      });
      const cells = getCoverageCells();
      expect(cells.map((cell) => cell.getAttribute("width"))).toEqual([
        "12.91",
        "17.49",
        "17.49",
        "12.91",
      ]);
      expect(cells.map((cell) => cell.getAttribute("fill-opacity"))).toEqual([
        "0.85",
        "0.15",
        "0.15",
        "0.85",
      ]);
    });
  });
});
