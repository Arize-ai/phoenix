import { getNetPerHour } from "../evaluationQueueStatParts";

describe("getNetPerHour", () => {
  it("is added minus completed, signed", () => {
    expect(
      getNetPerHour({ addedPerMinute: 2, completedPerMinute: 1 }).formatted
    ).toBe("+60");
    expect(
      getNetPerHour({ addedPerMinute: 1, completedPerMinute: 2 }).formatted
    ).toBe("−60");
  });

  it("marks the net as a lower bound once added is at the cap", () => {
    expect(
      getNetPerHour({
        addedPerMinute: 1_000_000 / 60,
        completedPerMinute: 1_000,
      })
    ).toEqual({ netPerHour: 940_000, formatted: "940,000+" });
  });
});
