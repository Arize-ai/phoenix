import { clampNumber } from "../numberUtils";

describe("clampNumber", () => {
  it("returns values inside the range unchanged", () => {
    expect(clampNumber({ value: 5, min: 0, max: 10 })).toEqual(5);
  });

  it("returns the minimum for values below the range", () => {
    expect(clampNumber({ value: -1, min: 0, max: 10 })).toEqual(0);
  });

  it("returns the maximum for values above the range", () => {
    expect(clampNumber({ value: 11, min: 0, max: 10 })).toEqual(10);
  });
});
