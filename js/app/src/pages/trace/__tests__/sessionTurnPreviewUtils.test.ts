import { describe, expect, it } from "vitest";

import type { SessionTurnPreviewTooltipUsageQuery$data } from "../__generated__/SessionTurnPreviewTooltipUsageQuery.graphql";
import {
  getTurnMetricsDetails,
  isSpanInView,
} from "../sessionTurnPreviewUtils";

type UsageNode = SessionTurnPreviewTooltipUsageQuery$data["node"];

describe("isSpanInView", () => {
  it("counts a row as visible when any of it is within its list", () => {
    const list = { top: 100, bottom: 400 };
    const visibilityByRowSpan = [
      [150, 200, true],
      [80, 120, true],
      [20, 70, false],
      [450, 500, false],
    ] as const;
    for (const [top, bottom, isVisible] of visibilityByRowSpan) {
      expect(isSpanInView({ top, bottom }, list)).toBe(isVisible);
    }
  });

  it("counts a row without layout as visible", () => {
    const noLayout = { top: 0, bottom: 0 };
    expect(isSpanInView(noLayout, noLayout)).toBe(true);
  });
});

describe("getTurnMetricsDetails", () => {
  const cost = (value: number) => ({ cost: value });
  const trace = {
    __typename: "Trace",
    rootSpan: {
      cumulativeTokenCountTotal: 30,
      cumulativeTokenCountPrompt: 20,
      cumulativeTokenCountCompletion: 10,
      cumulativeCostDetailSummaryEntries: [
        { tokenType: "audio", isPrompt: true, value: { tokens: 5 } },
      ],
    },
    costSummary: {
      total: cost(0.03),
      prompt: cost(0.02),
      completion: cost(0.01),
    },
    costDetailSummaryEntries: [
      { tokenType: "cache_read", isPrompt: true, value: { cost: 0.004 } },
    ],
  } as const satisfies UsageNode;

  it("splits tokens by the root span and costs by the trace", () => {
    expect(getTurnMetricsDetails(trace)).toEqual({
      tokens: {
        total: 30,
        prompt: 20,
        completion: 10,
        promptDetails: { audio: 5 },
        completionDetails: undefined,
      },
      costs: {
        total: 0.03,
        prompt: 0.02,
        completion: 0.01,
        promptDetails: { cache_read: 0.004 },
        completionDetails: undefined,
      },
    });
  });

  it("leaves out tokens for a trace without a root span", () => {
    expect(
      getTurnMetricsDetails({ ...trace, rootSpan: null }).tokens
    ).toBeNull();
  });

  it("has nothing to show for a node that isn't a trace", () => {
    expect(getTurnMetricsDetails({ __typename: "%other" })).toEqual({});
  });
});
