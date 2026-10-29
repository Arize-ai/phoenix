import { describe, expect, it } from "vitest";

import {
  rankChoiceProbabilities,
  rankPredicateProbabilities,
} from "../decisionProbabilityUtils";

const getValue = (entry: { value: string }) => entry.value;

describe("rankChoiceProbabilities", () => {
  it("lists options most likely first, ties in their given order", () => {
    expect(
      rankChoiceProbabilities({
        probabilities: [
          { value: "a", probability: 0.2 },
          { value: "b", probability: 0.6 },
          { value: "c", probability: 0.2 },
        ],
        getValue,
        chosen: "b",
      }).map(getValue)
    ).toEqual(["b", "a", "c"]);
  });

  it("drops options that display as 0%", () => {
    expect(
      rankChoiceProbabilities({
        probabilities: [
          { value: "zero", probability: 0 },
          { value: "tiny", probability: 0.0049 },
          { value: "small", probability: 0.005 },
          { value: "big", probability: 0.99 },
        ],
        getValue,
        chosen: "big",
      }).map(getValue)
    ).toEqual(["big", "small"]);
  });

  it("keeps the chosen option even when it displays as 0%", () => {
    expect(
      rankChoiceProbabilities({
        probabilities: [
          { value: "picked", probability: 0 },
          { value: "other", probability: 0 },
        ],
        getValue,
        chosen: "picked",
      }).map(getValue)
    ).toEqual(["picked"]);
  });
});

describe("rankPredicateProbabilities", () => {
  it("lists both options, the likelier first", () => {
    expect(rankPredicateProbabilities(0.2)).toEqual([
      { value: "False", probability: 0.8 },
      { value: "True", probability: 0.2 },
    ]);
  });

  it("drops the option that displays as 0%", () => {
    expect(rankPredicateProbabilities(0.998)).toEqual([
      { value: "True", probability: 0.998 },
    ]);
  });

  it("picks True on an even split", () => {
    expect(rankPredicateProbabilities(0.5).map((entry) => entry.value)).toEqual(
      ["True", "False"]
    );
  });
});
