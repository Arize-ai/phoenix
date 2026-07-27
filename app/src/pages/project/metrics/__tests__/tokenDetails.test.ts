import { describe, expect, it } from "vitest";

import {
  buildModelTokenDetailChartData,
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
    expect(series.map(({ tokenType }) => tokenType)).toEqual([
      "input",
      "output",
      "cache_read",
      "cache_write",
      "reasoning",
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
