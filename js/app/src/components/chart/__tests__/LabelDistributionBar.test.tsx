import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  LabelDistributionBar,
  type LabelDistributionBarProps,
  type LabelDistributionBarSegment,
} from "@phoenix/components/chart";

const YES_NO: LabelDistributionBarSegment[] = [
  { label: "yes", fraction: 0.8, count: 80, color: "rgb(0, 128, 0)" },
  { label: "no", fraction: 0.2, count: 20, color: "rgb(128, 128, 128)" },
];

describe("LabelDistributionBar", () => {
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

  const render = (props: LabelDistributionBarProps) => {
    act(() => {
      root.render(<LabelDistributionBar {...props} />);
    });
  };

  const getBar = () =>
    container.querySelector<HTMLElement>(
      '[data-testid="label-distribution-bar"]'
    );

  /** The drawn segments, in order. */
  const getSegments = () => [
    ...container.querySelectorAll<HTMLElement>(".segment-chart__segment"),
  ];

  /**
   * Each segment's share of the width left after the gaps, read back from
   * its `calc()` width (which the DOM normalizes to `calc(share * (…))`).
   */
  const getSegmentShares = () =>
    getSegments().map((segment) =>
      Number(segment.style.width.match(/([\d.]+) \* \(100% - \d+px\)/)?.[1])
    );

  /** Lays the segments out side by side, as a browser would, for hit tests. */
  const layOutSegments = (widths: number[]) => {
    let left = 0;
    getSegments().forEach((segment, index) => {
      const right = left + widths[index];
      const rect = { left, right, top: 0, bottom: 8, width: widths[index] };
      segment.getBoundingClientRect = () =>
        ({ ...rect, x: rect.left, y: 0, height: 8 }) as DOMRect;
      left = right + 2;
    });
  };

  const hoverAt = (clientX: number) => {
    act(() => {
      getBar()?.dispatchEvent(
        new MouseEvent("pointermove", { bubbles: true, clientX })
      );
    });
  };

  /** The tooltip's label rows: name and whether it is the hovered one. */
  const getTooltipRows = () =>
    [...document.body.querySelectorAll("li[data-active]")].map((row) => ({
      text: row.textContent,
      active: row.getAttribute("data-active"),
    }));

  it("draws one segment per label, in the given order and colors", () => {
    render({ segments: YES_NO });
    const segments = getSegments();
    expect(segments).toHaveLength(2);
    expect(segments.map((segment) => segment.style.backgroundColor)).toEqual([
      "rgb(0, 128, 0)",
      "rgb(128, 128, 128)",
    ]);
    // Sized by share, out of the width left after the gap between them
    expect(getSegmentShares()).toEqual([0.8, 0.2]);
  });

  it("leaves out labels with no share", () => {
    render({
      segments: [
        ...YES_NO,
        { label: "maybe", fraction: 0, count: 0, color: "red" },
      ],
    });
    expect(getSegments()).toHaveLength(2);
  });

  it("renders nothing when no label has a share", () => {
    render({ segments: [] });
    expect(getBar()).toBeNull();
    render({
      segments: [{ label: "yes", fraction: 0, color: "green" }],
    });
    expect(getBar()).toBeNull();
  });

  it("keeps a sliver of a share visible", () => {
    render({
      segments: [
        { label: "safe", fraction: 0.999, color: "green" },
        { label: "toxic", fraction: 0.001, color: "red" },
      ],
    });
    expect(getSegmentShares()[1]).toBeGreaterThanOrEqual(0.02);
  });

  it("names every label's share in its accessible label", () => {
    render({ segments: YES_NO, "aria-label": "is_correct labels" });
    expect(getBar()?.getAttribute("role")).toBe("img");
    expect(getBar()?.getAttribute("aria-label")).toBe(
      "is_correct labels: yes 80%, no 20%"
    );
  });

  it("sizes its box like a sparkline so the two align in a column", () => {
    render({ segments: YES_NO, maxWidth: 160 });
    expect(getBar()?.style.height).toBe("20px");
    expect(getBar()?.style.maxWidth).toBe("160px");
  });

  it("shows every label's share and count on hover, emphasizing the hovered one", () => {
    render({ segments: YES_NO });
    layOutSegments([80, 20]);
    hoverAt(90);
    expect(getTooltipRows()).toEqual([
      { text: "yes80% · n=80", active: "false" },
      { text: "no20% · n=20", active: "true" },
    ]);
    // In the gap between segments, the nearest one is hovered
    hoverAt(81);
    expect(getTooltipRows().map((row) => row.active)).toEqual([
      "true",
      "false",
    ]);
  });

  it("shows only the share when the count is unknown", () => {
    render({
      segments: YES_NO.map((segment) => ({ ...segment, count: null })),
    });
    layOutSegments([80, 20]);
    hoverAt(10);
    expect(getTooltipRows().map((row) => row.text)).toEqual([
      "yes80%",
      "no20%",
    ]);
  });

  it("hides the tooltip when the pointer leaves", () => {
    render({ segments: YES_NO });
    layOutSegments([80, 20]);
    hoverAt(10);
    expect(getTooltipRows()).toHaveLength(2);
    act(() => {
      getBar()?.dispatchEvent(
        new MouseEvent("pointerout", { bubbles: true, clientX: 500 })
      );
    });
    expect(getTooltipRows()).toHaveLength(0);
  });
});
