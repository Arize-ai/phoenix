import {
  createSequentialColorInterpolator,
  reverseColorInterpolator,
} from "../colors";

describe("createSequentialColorInterpolator", () => {
  it("hits the stops at the ends and blends between them", () => {
    const interpolate = createSequentialColorInterpolator([
      "#000000",
      "#0064c8",
    ]);
    expect(interpolate(0)).toBe("rgb(0, 0, 0)");
    expect(interpolate(1)).toBe("rgb(0, 100, 200)");
    expect(interpolate(0.5)).toBe("rgb(0, 50, 100)");
  });

  it("clamps t outside [0, 1]", () => {
    const interpolate = createSequentialColorInterpolator([
      "#000000",
      "#ffffff",
    ]);
    expect(interpolate(-1)).toBe("rgb(0, 0, 0)");
    expect(interpolate(2)).toBe("rgb(255, 255, 255)");
  });

  it("walks multi-stop ramps segment by segment", () => {
    const interpolate = createSequentialColorInterpolator([
      "#000000",
      "#640000",
      "#ff0000",
    ]);
    expect(interpolate(0.5)).toBe("rgb(100, 0, 0)");
    expect(interpolate(0.75)).toBe("rgb(178, 0, 0)");
  });
});

describe("reverseColorInterpolator", () => {
  it("flips the direction of a scale", () => {
    const interpolate = createSequentialColorInterpolator([
      "#000000",
      "#ffffff",
    ]);
    const reversed = reverseColorInterpolator(interpolate);
    expect(reversed(0)).toBe("rgb(255, 255, 255)");
    expect(reversed(1)).toBe("rgb(0, 0, 0)");
  });
});
