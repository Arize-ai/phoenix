import { describe, expect, it } from "vitest";

import {
  formatOmittedOptions,
  rankOptions,
  rankPredicateOptions,
} from "../decisionAnswers";

const values = (options: readonly { value: string }[]) =>
  options.map((option) => option.value);

describe("rankOptions", () => {
  it("lists options most likely first, ties in their given order", () => {
    const { probabilities } = rankOptions({
      options: [
        { value: "a", probability: 0.2 },
        { value: "b", probability: 0.6 },
        { value: "c", probability: 0.2 },
      ],
      chosen: "b",
    });
    expect(values(probabilities)).toEqual(["b", "a", "c"]);
  });

  it("leaves out options that display as 0% and counts them", () => {
    expect(
      rankOptions({
        options: [
          { value: "zero", probability: 0 },
          { value: "tiny", probability: 0.0049 },
          { value: "small", probability: 0.005 },
          { value: "big", probability: 0.99 },
        ],
        chosen: "big",
      })
    ).toEqual({
      probabilities: [
        { value: "big", probability: 0.99 },
        { value: "small", probability: 0.005 },
      ],
      omittedOptionCount: 2,
    });
  });

  it("keeps the chosen option even when it displays as 0%", () => {
    const { probabilities } = rankOptions({
      options: [
        { value: "picked", probability: 0 },
        { value: "other", probability: 0 },
      ],
      chosen: "picked",
    });
    expect(values(probabilities)).toEqual(["picked"]);
  });

  it("counts defined options the model did not report as left out", () => {
    expect(
      rankOptions({
        options: [{ value: "a", probability: 1 }],
        chosen: "a",
        optionValues: ["a", "b", "c"],
      }).omittedOptionCount
    ).toBe(2);
  });
});

describe("rankPredicateOptions", () => {
  it("lists both options, the likelier first", () => {
    expect(rankPredicateOptions(0.2)).toEqual({
      choice: "False",
      probabilities: [
        { value: "False", probability: 0.8 },
        { value: "True", probability: 0.2 },
      ],
      omittedOptionCount: 0,
    });
  });

  it("leaves out the option that displays as 0%", () => {
    expect(rankPredicateOptions(0.998)).toEqual({
      choice: "True",
      probabilities: [{ value: "True", probability: 0.998 }],
      omittedOptionCount: 1,
    });
  });

  it("picks True on an even split", () => {
    expect(values(rankPredicateOptions(0.5).probabilities)).toEqual([
      "True",
      "False",
    ]);
  });
});

describe("formatOmittedOptions", () => {
  it("names the options left out", () => {
    expect(formatOmittedOptions(1)).toBe("+1 option at 0%");
    expect(formatOmittedOptions(3)).toBe("+3 options at 0%");
  });
});
