import type { AgentFabPlacement } from "@phoenix/store/agentStore";

export type AgentFabBounds = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type AgentFabPoint = {
  x: number;
  y: number;
};

export type AgentFabSize = {
  width: number;
  height: number;
};

export type AgentFabInset = {
  horizontal: number;
  vertical: number;
};

export const AGENT_FAB_RESTING_SIZE: AgentFabSize = {
  width: 74,
  height: 36,
};

export const AGENT_FAB_STREAMING_SIZE: AgentFabSize = {
  width: 40,
  height: 40,
};

export const AGENT_FAB_INSET: AgentFabInset = {
  horizontal: 36,
  vertical: 24,
};

const AGENT_FAB_PLACEMENTS: AgentFabPlacement[] = [
  "top-start",
  "top-end",
  "bottom-start",
  "bottom-end",
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getAxisPosition({
  min,
  max,
  value,
}: {
  min: number;
  max: number;
  value: number;
}): number {
  if (max < min) {
    return min + (max - min) / 2;
  }
  return clamp(value, min, max);
}

export function clampAgentFabPosition({
  point,
  bounds,
  size,
  inset = AGENT_FAB_INSET,
}: {
  point: AgentFabPoint;
  bounds: AgentFabBounds;
  size: AgentFabSize;
  inset?: AgentFabInset;
}): AgentFabPoint {
  const minX = bounds.left + inset.horizontal;
  const maxX = bounds.left + bounds.width - size.width - inset.horizontal;
  const minY = bounds.top + inset.vertical;
  const maxY = bounds.top + bounds.height - size.height - inset.vertical;

  return {
    x: getAxisPosition({ min: minX, max: maxX, value: point.x }),
    y: getAxisPosition({ min: minY, max: maxY, value: point.y }),
  };
}

export function getAgentFabPinnedPosition({
  placement,
  bounds,
  size,
  inset = AGENT_FAB_INSET,
}: {
  placement: AgentFabPlacement;
  bounds: AgentFabBounds;
  size: AgentFabSize;
  inset?: AgentFabInset;
}): AgentFabPoint {
  const x = placement.endsWith("end")
    ? bounds.left + bounds.width - size.width - inset.horizontal
    : bounds.left + inset.horizontal;
  const y = placement.startsWith("bottom")
    ? bounds.top + bounds.height - size.height - inset.vertical
    : bounds.top + inset.vertical;

  return clampAgentFabPosition({ point: { x, y }, bounds, size, inset });
}

export function getNearestAgentFabPlacement({
  point,
  bounds,
  size,
  inset = AGENT_FAB_INSET,
}: {
  point: AgentFabPoint;
  bounds: AgentFabBounds;
  size: AgentFabSize;
  inset?: AgentFabInset;
}): AgentFabPlacement {
  const center = {
    x: point.x + size.width / 2,
    y: point.y + size.height / 2,
  };

  let nearestPlacement = AGENT_FAB_PLACEMENTS[0];
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const placement of AGENT_FAB_PLACEMENTS) {
    const target = getAgentFabPinnedPosition({
      placement,
      bounds,
      size,
      inset,
    });
    const targetCenter = {
      x: target.x + size.width / 2,
      y: target.y + size.height / 2,
    };
    const distance =
      (center.x - targetCenter.x) ** 2 + (center.y - targetCenter.y) ** 2;

    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestPlacement = placement;
    }
  }

  return nearestPlacement;
}
