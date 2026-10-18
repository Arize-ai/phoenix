import { choicesToOutputConfigValues } from "../utils";

describe("choicesToOutputConfigValues", () => {
  it("converts a label-to-score map to label+score values", () => {
    expect(choicesToOutputConfigValues({ correct: 1, incorrect: 0 })).toEqual([
      { label: "correct", score: 1 },
      { label: "incorrect", score: 0 },
    ]);
  });

  it("converts a list of labels to label-only values (no score)", () => {
    expect(
      choicesToOutputConfigValues(["english", "spanish", "other"])
    ).toEqual([{ label: "english" }, { label: "spanish" }, { label: "other" }]);
  });

  it("returns an empty array for unrecognized shapes", () => {
    expect(choicesToOutputConfigValues(null)).toEqual([]);
    expect(choicesToOutputConfigValues(undefined)).toEqual([]);
    expect(choicesToOutputConfigValues("english")).toEqual([]);
    expect(choicesToOutputConfigValues({ correct: "high" })).toEqual([]);
    expect(choicesToOutputConfigValues([1, 2, 3])).toEqual([]);
  });
});
