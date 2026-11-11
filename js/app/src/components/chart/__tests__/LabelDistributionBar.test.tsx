import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  formatLegendPercent,
  getFittingLegendItemCount,
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

  it("grows up to its max width, like a sparkline", () => {
    render({ segments: YES_NO, maxWidth: 160 });
    expect(getBar()?.style.maxWidth).toBe("160px");
  });

  const getPriorTick = () =>
    container.querySelector<HTMLElement>(".label-distribution-bar__prior-tick");

  it("marks the prior share with a tick at that share of the width", () => {
    render({
      segments: YES_NO,
      prior: {
        label: "yes",
        fraction: 0.83,
        description: "in the previous 7d",
      },
    });
    expect(getPriorTick()?.style.left).toBe("83%");
  });

  it("keeps the tick on the bar for a prior share out of range", () => {
    render({
      segments: YES_NO,
      prior: { label: "yes", fraction: 1.2, description: "before" },
    });
    expect(getPriorTick()?.style.left).toBe("100%");
  });

  it("draws no tick without a prior", () => {
    render({ segments: YES_NO });
    expect(getPriorTick()).toBeNull();
    render({ segments: YES_NO, prior: null });
    expect(getPriorTick()).toBeNull();
  });

  it("names the prior in the tooltip and the accessible label", () => {
    render({
      segments: YES_NO,
      prior: {
        label: "yes",
        fraction: 0.83,
        description: "in the previous 7d",
      },
      "aria-label": "is_correct labels",
    });
    expect(getBar()?.getAttribute("aria-label")).toBe(
      "is_correct labels: yes 80%, no 20%; tick: yes 83% in the previous 7d"
    );
    layOutSegments([80, 20]);
    hoverAt(10);
    expect(document.body.textContent).toContain(
      "tick: yes 83% in the previous 7d"
    );
  });

  /** The legend's shown items' text, then the overflow marker if any. */
  const getLegendText = () => {
    const legend = container.querySelector(".label-distribution-bar__legend");
    return [...(legend?.children ?? [])]
      .filter(
        (child) =>
          !child.classList.contains("label-distribution-bar__legend-measure")
      )
      .map((child) => child.textContent);
  };

  it("lists each label's whole-number percent under the bar, in order", () => {
    render({
      segments: [
        { label: "positive", fraction: 0.712, color: "rgb(1, 1, 1)" },
        { label: "neutral", fraction: 0.234, color: "rgb(2, 2, 2)" },
        { label: "negative", fraction: 0.054, color: "rgb(3, 3, 3)" },
      ],
    });
    expect(getLegendText()).toEqual(["71", "23", "5"]);
    const swatches = [
      ...container.querySelectorAll<HTMLElement>(
        ".label-distribution-bar__legend > .label-distribution-bar__legend-item > .label-distribution-bar__legend-swatch"
      ),
    ];
    expect(swatches.map((swatch) => swatch.style.backgroundColor)).toEqual([
      "rgb(1, 1, 1)",
      "rgb(2, 2, 2)",
      "rgb(3, 3, 3)",
    ]);
  });

  it("leaves the legend out when asked", () => {
    render({ segments: YES_NO, showLegend: false });
    expect(
      container.querySelector(".label-distribution-bar__legend")
    ).toBeNull();
  });

  it("shows as many legend items as fit, then +N", () => {
    // Lay out a 64px legend whose items are 20px each and whose "+N" is 12px
    const spy = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: HTMLElement) {
        const width = this.classList.contains("label-distribution-bar__legend")
          ? 64
          : this.classList.contains("label-distribution-bar__legend-item")
            ? 20
            : this.classList.contains("label-distribution-bar__legend-overflow")
              ? 12
              : 0;
        return {
          width,
          height: 12,
          left: 0,
          right: width,
          top: 0,
          bottom: 12,
          x: 0,
          y: 0,
        } as DOMRect;
      });
    try {
      render({
        segments: ["A", "B", "C", "D", "E"].map((label, index) => ({
          label,
          fraction: 0.2,
          color: `rgb(${index}, 0, 0)`,
        })),
      });
      // "+3" (12) plus two items and their gaps (2 × 26) just fit in 64px
      expect(getLegendText()).toEqual(["20", "20", "+3"]);
    } finally {
      spy.mockRestore();
    }
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

describe("formatLegendPercent", () => {
  it("rounds to whole percents without a sign", () => {
    expect(formatLegendPercent(0.712)).toBe("71");
    expect(formatLegendPercent(1)).toBe("100");
    expect(formatLegendPercent(0.005)).toBe("1");
  });

  it("shows a trace of a share as <1 rather than 0", () => {
    expect(formatLegendPercent(0.004)).toBe("<1");
    expect(formatLegendPercent(0)).toBe("0");
  });
});

describe("getFittingLegendItemCount", () => {
  const fit = (availableWidth: number) =>
    getFittingLegendItemCount({
      itemWidths: [20, 20, 20],
      availableWidth,
      overflowWidth: 12,
      gap: 6,
    });

  it("fits every item when they all fit, with no room kept for +N", () => {
    expect(fit(72)).toBe(3);
  });

  it("keeps room for +N after the items that fit", () => {
    expect(fit(71)).toBe(2);
    expect(fit(64)).toBe(2);
    expect(fit(63)).toBe(1);
  });

  it("shows only +N when not even one item fits beside it", () => {
    expect(fit(20)).toBe(0);
  });

  it("fits everything before the width is measured", () => {
    expect(fit(0)).toBe(3);
  });
});
