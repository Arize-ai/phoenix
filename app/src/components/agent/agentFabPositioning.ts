import type { AgentFabPlacement } from "@phoenix/store/agentStore";
import type { Bounds, Inset, Point, Size } from "@phoenix/types/geometry";

// FAB dimensions derived from the animated motion.div in AgentChatWidget's
// `AgentChatWidgetButton`. Both axes are content-box width plus horizontal
// padding (CSS `box-sizing: content-box` is the default).
//
// Resting: content 58 + paddingLeft 8 + paddingRight 8 = 74 wide, 36 tall.
// Streaming: content 40 + paddingLeft 0 + paddingRight 0 = 40 square.
//
// If you change those values in AgentChatWidget, update these in lockstep —
// snap math reads from here when the live element hasn't been measured yet
// (first paint), and AgentChatWidget passes these as the explicit size prop
// to keep the snap math stable across the streaming-state transition.
const FAB_CONTENT_WIDTH_RESTING = 58;
const FAB_CONTENT_HEIGHT_RESTING = 36;
const FAB_HORIZONTAL_PADDING_RESTING = 8;
const FAB_CONTENT_WIDTH_STREAMING = 40;
const FAB_CONTENT_HEIGHT_STREAMING = 40;

export const FAB_RESTING_SIZE: Size = {
  width: FAB_CONTENT_WIDTH_RESTING + 2 * FAB_HORIZONTAL_PADDING_RESTING,
  height: FAB_CONTENT_HEIGHT_RESTING,
};
export const FAB_STREAMING_SIZE: Size = {
  width: FAB_CONTENT_WIDTH_STREAMING,
  height: FAB_CONTENT_HEIGHT_STREAMING,
};

// Distance from each edge of the positioning boundary to the corresponding
// edge of the FAB when pinned. Mirrors the original `floatingButtonCSS`
// `bottom: 24px; right: 36px` values so the corner placement matches the
// pre-drag location pixel-for-pixel.
export const FAB_INSET: Inset = { horizontal: 36, vertical: 24 };

const FAB_PLACEMENTS: AgentFabPlacement[] = [
  "top-start",
  "top-end",
  "bottom-start",
  "bottom-end",
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function resolveAxisPosition({
  min,
  max,
  value,
}: {
  min: number;
  max: number;
  value: number;
}): number {
  // The boundary may be narrower/shorter than the FAB plus both insets — in
  // that case `max < min` and `clamp` would collapse to `min`, jamming the
  // FAB against one edge. Center it within the available space instead.
  if (max < min) {
    return min + (max - min) / 2;
  }
  return clamp(value, min, max);
}

export function clampFabPosition({
  point,
  bounds,
  size,
  inset = FAB_INSET,
}: {
  point: Point;
  bounds: Bounds;
  size: Size;
  inset?: Inset;
}): Point {
  const minX = bounds.left + inset.horizontal;
  const maxX = bounds.left + bounds.width - size.width - inset.horizontal;
  const minY = bounds.top + inset.vertical;
  const maxY = bounds.top + bounds.height - size.height - inset.vertical;

  return {
    x: resolveAxisPosition({ min: minX, max: maxX, value: point.x }),
    y: resolveAxisPosition({ min: minY, max: maxY, value: point.y }),
  };
}

export function getFabPinnedPosition({
  placement,
  bounds,
  size,
  inset = FAB_INSET,
}: {
  placement: AgentFabPlacement;
  bounds: Bounds;
  size: Size;
  inset?: Inset;
}): Point {
  const x = placement.endsWith("end")
    ? bounds.left + bounds.width - size.width - inset.horizontal
    : bounds.left + inset.horizontal;
  const y = placement.startsWith("bottom")
    ? bounds.top + bounds.height - size.height - inset.vertical
    : bounds.top + inset.vertical;

  return clampFabPosition({ point: { x, y }, bounds, size, inset });
}

export function getNearestFabPlacement({
  point,
  bounds,
  size,
  inset = FAB_INSET,
}: {
  point: Point;
  bounds: Bounds;
  size: Size;
  inset?: Inset;
}): AgentFabPlacement {
  const pointCenter = {
    x: point.x + size.width / 2,
    y: point.y + size.height / 2,
  };

  let nearestPlacement = FAB_PLACEMENTS[0];
  let nearestSquaredDistance = Number.POSITIVE_INFINITY;

  for (const placement of FAB_PLACEMENTS) {
    const pinnedPosition = getFabPinnedPosition({
      placement,
      bounds,
      size,
      inset,
    });
    const pinnedCenter = {
      x: pinnedPosition.x + size.width / 2,
      y: pinnedPosition.y + size.height / 2,
    };
    // Squared distance — we only need to compare, not measure, so skip sqrt.
    const squaredDistance =
      (pointCenter.x - pinnedCenter.x) ** 2 +
      (pointCenter.y - pinnedCenter.y) ** 2;

    if (squaredDistance < nearestSquaredDistance) {
      nearestSquaredDistance = squaredDistance;
      nearestPlacement = placement;
    }
  }

  return nearestPlacement;
}
