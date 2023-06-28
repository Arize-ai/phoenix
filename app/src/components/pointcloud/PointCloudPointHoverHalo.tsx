import React from "react";
import { Sphere } from "@react-three/drei";

import { usePointCloudContext } from "@phoenix/contexts";

const POINT_RADIUS_MULTIPLIER = 1.5;

export function PointCloudPointHoverHalo({
  pointRadius,
}: {
  /**
   * The radius of the point. This is scaled up to be encompassed via the halo
   */
  pointRadius: number;
}) {
  const hoveredEventId = usePointCloudContext((state) => state.hoveredEventId);
  const eventIdToDataMap = usePointCloudContext(
    (state) => state.eventIdToDataMap
  );
  const pointGroupColors = usePointCloudContext(
    (state) => state.pointGroupColors
  );
  const eventIdToGroup = usePointCloudContext((state) => state.eventIdToGroup);
  if (hoveredEventId == null || eventIdToDataMap == null) return null;
  const event = eventIdToDataMap.get(hoveredEventId);
  const group = eventIdToGroup[hoveredEventId];
  const color = pointGroupColors[group];

  if (event == null) return null;

  return (
    <Sphere
      position={event.position}
      args={[pointRadius * POINT_RADIUS_MULTIPLIER]}
    >
      <meshMatcapMaterial color={color} opacity={0.5} transparent />
    </Sphere>
  );
}
