import { getBinInterval } from "../useBinInterval";

describe("getBinInterval", () => {
  it("keeps the legacy interval when bin count is unavailable", () => {
    expect(getBinInterval({ scale: "HOUR" })).toEqual(1);
    expect(getBinInterval({ scale: "MINUTE" })).toEqual(5);
  });

  it.each([
    { binCount: 1, expectedInterval: 0 },
    { binCount: 8, expectedInterval: 0 },
    { binCount: 9, expectedInterval: 1 },
    { binCount: 48, expectedInterval: 5 },
    { binCount: 300, expectedInterval: 37 },
  ])(
    "returns $expectedInterval for $binCount bins with the default max tick count",
    ({ binCount, expectedInterval }) => {
      expect(getBinInterval({ scale: "HOUR", binCount })).toEqual(
        expectedInterval
      );
    }
  );

  it("honors a custom max tick count", () => {
    expect(
      getBinInterval({ scale: "DAY", binCount: 48, maxTickCount: 12 })
    ).toEqual(3);
  });
});
