import { describe, expect, it } from "vitest";

import type { useCategoryChartColors } from "@phoenix/components/chart";

import type { ModelTokenDetailChartDatum } from "../tokenDetails";
import {
  buildModelTokenDetailChartData,
  getCostChartEmptyStateMessage,
  getModelTokenDetailBarRadius,
  getModelTokenDetailColors,
  getModelTokenDetailDataKey,
} from "../tokenDetails";

describe("buildModelTokenDetailChartData", () => {
  it("breaks token totals down by type and fills unclassified remainders", () => {
    const { chartData, series } = buildModelTokenDetailChartData({
      metric: "tokens",
      models: [
        {
          name: "gpt-test",
          costSummary: {
            prompt: { tokens: 100 },
            completion: { tokens: 30 },
            total: { tokens: 130 },
          },
          costDetailSummaryEntries: [
            {
              tokenType: "input",
              isPrompt: true,
              value: { tokens: 20 },
            },
            {
              tokenType: "cache_read",
              isPrompt: true,
              value: { tokens: 50 },
            },
            {
              tokenType: "cache_write",
              isPrompt: true,
              value: { tokens: 10 },
            },
            {
              tokenType: "output",
              isPrompt: false,
              value: { tokens: 20 },
            },
            {
              tokenType: "reasoning",
              isPrompt: false,
              value: { tokens: 5 },
            },
          ],
        },
      ],
    });

    expect(chartData).toEqual([
      {
        model: "gpt-test",
        total: 130,
        [getModelTokenDetailDataKey({
          isPrompt: true,
          tokenType: "input",
        })]: 40,
        [getModelTokenDetailDataKey({
          isPrompt: true,
          tokenType: "cache_read",
        })]: 50,
        [getModelTokenDetailDataKey({
          isPrompt: true,
          tokenType: "cache_write",
        })]: 10,
        [getModelTokenDetailDataKey({
          isPrompt: false,
          tokenType: "output",
        })]: 25,
        [getModelTokenDetailDataKey({
          isPrompt: false,
          tokenType: "reasoning",
        })]: 5,
      },
    ]);
    // Prompt series first, then completion, each in canonical token order
    expect(
      series.map(({ isPrompt, tokenType }) => [tokenType, isPrompt])
    ).toEqual([
      ["input", true],
      ["cache_read", true],
      ["cache_write", true],
      ["output", false],
      ["reasoning", false],
    ]);
  });

  it("uses token-type costs for the cost chart", () => {
    const { chartData } = buildModelTokenDetailChartData({
      metric: "cost",
      models: [
        {
          name: "gpt-test",
          costSummary: {
            prompt: { cost: 0.8 },
            completion: { cost: 0.2 },
            total: { cost: 1 },
          },
          costDetailSummaryEntries: [
            {
              tokenType: "cache_read",
              isPrompt: true,
              value: { cost: 0.3 },
            },
            {
              tokenType: "output",
              isPrompt: false,
              value: { cost: 0.2 },
            },
          ],
        },
      ],
    });

    expect(chartData[0]).toMatchObject({
      model: "gpt-test",
      total: 1,
      [getModelTokenDetailDataKey({
        isPrompt: true,
        tokenType: "input",
      })]: 0.5,
      [getModelTokenDetailDataKey({
        isPrompt: true,
        tokenType: "cache_read",
      })]: 0.3,
      [getModelTokenDetailDataKey({
        isPrompt: false,
        tokenType: "output",
      })]: 0.2,
    });
  });
});

describe("getModelTokenDetailBarRadius", () => {
  const allSeries = [
    { dataKey: "input", isPrompt: true, tokenType: "input" },
    { dataKey: "output", isPrompt: false, tokenType: "output" },
    { dataKey: "cacheRead", isPrompt: true, tokenType: "cache_read" },
    { dataKey: "cacheWrite", isPrompt: true, tokenType: "cache_write" },
  ];
  const noneHidden = () => false;
  const radiusFor = ({
    datum,
    dataKey,
    isDataKeyHidden = noneHidden,
  }: {
    datum: ModelTokenDetailChartDatum;
    dataKey: string;
    isDataKeyHidden?: (dataKey: string) => boolean;
  }) =>
    getModelTokenDetailBarRadius({
      allSeries,
      datum,
      isDataKeyHidden,
      series: allSeries.find((series) => series.dataKey === dataKey)!,
    });

  it("rounds the ends of the segments a row actually draws", () => {
    // No cache writes, so the stack ends at cache read rather than the last
    // series, and output is absent entirely
    const datum = { model: "gpt", total: 6, input: 1, output: 2, cacheRead: 3 };

    expect(radiusFor({ datum, dataKey: "input" })).toEqual([2, 0, 0, 2]);
    expect(radiusFor({ datum, dataKey: "output" })).toBeUndefined();
    expect(radiusFor({ datum, dataKey: "cacheRead" })).toEqual([0, 2, 2, 0]);
    expect(radiusFor({ datum, dataKey: "cacheWrite" })).toBeUndefined();
  });

  it("rounds both ends of a row with a single segment", () => {
    const datum = { model: "gpt", total: 4, cacheWrite: 4 };

    expect(radiusFor({ datum, dataKey: "cacheWrite" })).toEqual([2, 2, 2, 2]);
  });

  it("ignores series the legend is hiding", () => {
    const datum = {
      model: "gpt",
      total: 6,
      input: 1,
      output: 2,
      cacheWrite: 3,
    };
    const isDataKeyHidden = (dataKey: string) => dataKey === "input";

    expect(radiusFor({ datum, dataKey: "output", isDataKeyHidden })).toEqual([
      2, 0, 0, 2,
    ]);
  });
});

describe("getModelTokenDetailColors", () => {
  const colors = Object.fromEntries(
    Array.from({ length: 12 }, (_, index) => [
      `category${index + 1}`,
      `color-${index + 1}`,
    ])
  ) as ReturnType<typeof useCategoryChartColors>;

  it("gives prompt and completion usage of one token type different colors", () => {
    const colorByDataKey = getModelTokenDetailColors({
      colors,
      series: [
        { dataKey: "promptAudio", isPrompt: true, tokenType: "audio" },
        { dataKey: "completionAudio", isPrompt: false, tokenType: "audio" },
      ],
    });

    expect(colorByDataKey.get("promptAudio")).not.toBe(
      colorByDataKey.get("completionAudio")
    );
  });
});

describe("getCostChartEmptyStateMessage", () => {
  it("blames the time range only when nothing ran in it", () => {
    expect(
      getCostChartEmptyStateMessage({ modelCount: 0, tokenCount: 0 })
    ).toBe("No data in this time range");
  });

  it("points at pricing when tokens were recorded but no model was priced", () => {
    // An unpriced project: SpanCost rows carry tokens with a null model_id, so
    // they count toward the project total but drop out of topModelsByCost
    expect(
      getCostChartEmptyStateMessage({ modelCount: 0, tokenCount: 4200 })
    ).toBe("No cost data. Model pricing may not be configured.");
  });

  it("points at pricing when priced models ran but cost nothing", () => {
    expect(
      getCostChartEmptyStateMessage({ modelCount: 2, tokenCount: 0 })
    ).toBe("No cost data. Model pricing may not be configured.");
  });
});
