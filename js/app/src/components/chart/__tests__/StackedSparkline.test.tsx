import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  getStackedSparklineColumns,
  StackedSparkline,
  type StackedSparklineProps,
} from "@phoenix/components/chart";

const CATEGORIES = [
  { key: "yes", color: "green" },
  { key: "no", color: "gray" },
];

describe("StackedSparkline", () => {
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

  const render = (props: Partial<StackedSparklineProps>) => {
    act(() => {
      root.render(
        <StackedSparkline categories={CATEGORIES} values={[]} {...props} />
      );
    });
  };

  const getColumns = () => [
    ...container.querySelectorAll<SVGGElement>(".stacked-sparkline__column"),
  ];

  /** Each column's segments as [category, y, height], bottom up. */
  const getSegments = (column: SVGGElement) =>
    [...column.querySelectorAll("rect")].map((rect) => [
      rect.getAttribute("data-category"),
      rect.getAttribute("y"),
      rect.getAttribute("height"),
    ]);

  it("stacks each bin's shares bottom up in category order", () => {
    render({ values: [[0.75, 0.25]] });
    const [column] = getColumns();
    expect(getSegments(column)).toEqual([
      ["yes", "5.00", "15.00"],
      ["no", "0.00", "5.00"],
    ]);
    expect(
      [...column.querySelectorAll("rect")].map((rect) =>
        rect.getAttribute("fill")
      )
    ).toEqual(["green", "gray"]);
  });

  it("leaves a share below one as empty room at the top", () => {
    render({ values: [[0.5, 0.25]] });
    expect(getSegments(getColumns()[0])).toEqual([
      ["yes", "10.00", "10.00"],
      ["no", "5.00", "5.00"],
    ]);
  });

  it("puts each bin on the sparkline's axis and leaves empty bins blank", () => {
    render({ values: [[1, 0], null, [0, 1]] });
    const columns = getColumns();
    expect(
      columns.map((column) => column.getAttribute("data-position"))
    ).toEqual(["0", "2"]);
    // Bins are 32 drawing units apart, as in the Sparkline: the first is
    // clipped at the left edge, the last at the right, less the column gap
    const [first, last] = columns.map((column) => column.querySelector("rect"));
    expect(Number(first?.getAttribute("x"))).toBeCloseTo(0.2, 1);
    expect(Number(first?.getAttribute("width"))).toBeCloseTo(15.6, 1);
    expect(Number(last?.getAttribute("x"))).toBeCloseTo(48.2, 1);
  });

  it("renders nothing when no bin holds data", () => {
    render({ values: [null, null] });
    expect(container.querySelector("svg")).toBeNull();
  });

  it("names itself for assistive technology", () => {
    render({ values: [[1, 0]], "aria-label": "verdict labels per bin" });
    expect(container.querySelector("svg title")?.textContent).toBe(
      "verdict labels per bin"
    );
  });

  it("shows the hovered column's detail and fades the others", () => {
    render({
      values: [
        [1, 0],
        [0.5, 0.5],
      ],
      weights: [3, 4],
      renderBinDetail: ({ range, shares, weight }) =>
        `bins ${range.start}-${range.end}: ${shares.join("/")} of ${weight}`,
    });
    const svg = container.querySelector("svg");
    if (svg == null) {
      throw new Error("expected a chart");
    }
    svg.getBoundingClientRect = () =>
      ({ left: 0, width: 64, top: 0, height: 20 }) as DOMRect;
    act(() => {
      svg.dispatchEvent(
        new MouseEvent("pointermove", { bubbles: true, clientX: 60 })
      );
    });
    expect(document.body.textContent).toContain("bins 1-1: 0.5/0.5 of 4");
    expect(
      getColumns().map((column) => column.getAttribute("opacity"))
    ).toEqual(["0.35", "1"]);
    act(() => {
      svg.dispatchEvent(new MouseEvent("pointerout", { bubbles: true }));
    });
    expect(document.body.textContent).not.toContain("bins 1-1");
  });
});

describe("getStackedSparklineColumns", () => {
  it("merges bins the way the Sparkline does, weighting each bin's shares", () => {
    // 8 bins in 16px leave room for 4 columns, so pairs of bins merge
    const columns = getStackedSparklineColumns({
      values: [[1, 0], [0, 1], null, [0.5, 0.5], null, null, [1, 0], [1, 0]],
      weights: [3, 1, 0, 2, 0, 0, 1, 1],
      categoryCount: 2,
      width: 16,
    });
    expect(columns.map((column) => column.range)).toEqual([
      { start: 0, end: 1 },
      { start: 2, end: 3 },
      { start: 4, end: 5 },
      { start: 6, end: 7 },
    ]);
    expect(columns.map((column) => column.shares)).toEqual([
      [0.75, 0.25],
      [0.5, 0.5],
      null,
      [1, 0],
    ]);
    expect(columns.map((column) => column.weight)).toEqual([4, 2, 0, 2]);
  });

  it("ignores a bin with shares but no weight", () => {
    const [column] = getStackedSparklineColumns({
      values: [[1, 0]],
      weights: [0],
      categoryCount: 2,
      width: 160,
    });
    expect(column.shares).toBeNull();
  });
});
