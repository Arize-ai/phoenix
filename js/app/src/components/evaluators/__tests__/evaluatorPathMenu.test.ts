import { describe, expect, it } from "vitest";

import { matchDisplayedKey } from "../evaluatorPathMenu";

describe("matchDisplayedKey", () => {
  it("keeps the matches of a row shown as its label", () => {
    expect(matchDisplayedKey({ label: "input" }, [0, 2])).toEqual([0, 2]);
  });

  // `metadata.latency_ms` shows as `latency_ms`, so typing `lat` highlights
  // the start of what is shown.
  it("shifts matches onto a name shown without its home", () => {
    expect(
      matchDisplayedKey(
        { label: "metadata.latency_ms", displayLabel: "latency_ms" },
        [9, 12]
      )
    ).toEqual([0, 3]);
  });

  it("drops a match that falls in the home left off", () => {
    expect(
      matchDisplayedKey(
        { label: "metadata.latency_ms", displayLabel: "latency_ms" },
        [0, 3, 9, 12]
      )
    ).toEqual([0, 3]);
  });

  it("highlights nothing on a row shown as prose", () => {
    expect(
      matchDisplayedKey(
        { label: "input.messages[-1].content", displayLabel: "Last message" },
        [0, 5]
      )
    ).toEqual([]);
  });
});
