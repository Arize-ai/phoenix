import { describe, expect, it } from "vitest";

import type { Bounds, Size } from "@phoenix/types/geometry";

import {
  clampFabPosition,
  getFabPinnedPosition,
  getNearestFabPlacement,
} from "../agentFabPositioning";

const bounds: Bounds = {
  left: 100,
  top: 80,
  width: 900,
  height: 600,
};

const size: Size = {
  width: 58,
  height: 36,
};

describe("agent FAB positioning", () => {
  it("pins the FAB to the requested corner within the visible bounds", () => {
    expect(
      getFabPinnedPosition({ placement: "top-start", bounds, size })
    ).toEqual({
      x: 124,
      y: 104,
    });
    expect(
      getFabPinnedPosition({ placement: "top-end", bounds, size })
    ).toEqual({
      x: 918,
      y: 104,
    });
    expect(
      getFabPinnedPosition({ placement: "bottom-start", bounds, size })
    ).toEqual({
      x: 124,
      y: 620,
    });
    expect(
      getFabPinnedPosition({ placement: "bottom-end", bounds, size })
    ).toEqual({
      x: 918,
      y: 620,
    });
  });

  it("chooses the nearest pinned corner for dropped positions", () => {
    expect(
      getNearestFabPlacement({
        point: { x: 130, y: 120 },
        bounds,
        size,
      })
    ).toBe("top-start");
    expect(
      getNearestFabPlacement({
        point: { x: 900, y: 120 },
        bounds,
        size,
      })
    ).toBe("top-end");
    expect(
      getNearestFabPlacement({
        point: { x: 130, y: 610 },
        bounds,
        size,
      })
    ).toBe("bottom-start");
    expect(
      getNearestFabPlacement({
        point: { x: 900, y: 610 },
        bounds,
        size,
      })
    ).toBe("bottom-end");
  });

  it("clamps transient drag positions to the visible bounds", () => {
    expect(
      clampFabPosition({
        point: { x: -100, y: 1000 },
        bounds,
        size,
      })
    ).toEqual({
      x: 124,
      y: 620,
    });
  });
});
