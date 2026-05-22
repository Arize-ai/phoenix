import { describe, expect, it } from "vitest";

import {
  clampAgentFabPosition,
  getAgentFabPinnedPosition,
  getNearestAgentFabPlacement,
  type AgentFabBounds,
  type AgentFabSize,
} from "../agentFabPositioning";

const bounds: AgentFabBounds = {
  left: 100,
  top: 80,
  width: 900,
  height: 600,
};

const size: AgentFabSize = {
  width: 58,
  height: 36,
};

describe("agent FAB positioning", () => {
  it("pins the FAB to the requested corner within the visible bounds", () => {
    expect(
      getAgentFabPinnedPosition({ placement: "top-start", bounds, size })
    ).toEqual({
      x: 136,
      y: 104,
    });
    expect(
      getAgentFabPinnedPosition({ placement: "top-end", bounds, size })
    ).toEqual({
      x: 906,
      y: 104,
    });
    expect(
      getAgentFabPinnedPosition({ placement: "bottom-start", bounds, size })
    ).toEqual({
      x: 136,
      y: 620,
    });
    expect(
      getAgentFabPinnedPosition({ placement: "bottom-end", bounds, size })
    ).toEqual({
      x: 906,
      y: 620,
    });
  });

  it("chooses the nearest pinned corner for dropped positions", () => {
    expect(
      getNearestAgentFabPlacement({
        point: { x: 130, y: 120 },
        bounds,
        size,
      })
    ).toBe("top-start");
    expect(
      getNearestAgentFabPlacement({
        point: { x: 900, y: 120 },
        bounds,
        size,
      })
    ).toBe("top-end");
    expect(
      getNearestAgentFabPlacement({
        point: { x: 130, y: 610 },
        bounds,
        size,
      })
    ).toBe("bottom-start");
    expect(
      getNearestAgentFabPlacement({
        point: { x: 900, y: 610 },
        bounds,
        size,
      })
    ).toBe("bottom-end");
  });

  it("clamps transient drag positions to the visible bounds", () => {
    expect(
      clampAgentFabPosition({
        point: { x: -100, y: 1000 },
        bounds,
        size,
      })
    ).toEqual({
      x: 136,
      y: 620,
    });
  });
});
