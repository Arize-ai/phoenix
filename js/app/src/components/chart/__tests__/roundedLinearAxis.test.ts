import { getRoundedLinearAxis } from "../roundedLinearAxis";

describe("getRoundedLinearAxis", () => {
  it("snaps the top to the next round tick instead of doubling the range", () => {
    expect(getRoundedLinearAxis({ values: [4.17, 3.4] })).toEqual({
      domain: [0, 5],
      ticks: [0, 1, 2, 3, 4, 5],
    });
  });

  it("uses a fractional step for small ranges", () => {
    expect(getRoundedLinearAxis({ values: [1.2] })).toEqual({
      domain: [0, 1.25],
      ticks: [0, 0.25, 0.5, 0.75, 1, 1.25],
    });
  });

  it("includes zero and extends below it for negative values", () => {
    expect(getRoundedLinearAxis({ values: [-3, 6.7] })).toEqual({
      domain: [-5, 7.5],
      ticks: [-5, -2.5, 0, 2.5, 5, 7.5],
    });
  });

  it("returns undefined when there is no range to scale", () => {
    expect(getRoundedLinearAxis({ values: [] })).toBeUndefined();
    expect(getRoundedLinearAxis({ values: [0, 0] })).toBeUndefined();
  });
});
