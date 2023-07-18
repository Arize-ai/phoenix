import React, { useMemo, useRef } from "react";
import { QuadraticBezierLine } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";

import { usePointCloudContext } from "@phoenix/contexts";

type Line = [ThreeDimensionalPosition, ThreeDimensionalPosition];

const lineWidth = 1;

/**
 * Draws the relationships between points
 */
export function PointCloudPointRelationships() {
  const hoveredEventId = usePointCloudContext((state) => state.hoveredEventId);
  const eventIdToDataMap = usePointCloudContext(
    (state) => state.eventIdToDataMap
  );
  const group = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (group.current) {
      group.current.children.forEach(
        (group) =>
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          (group.children[0].material.uniforms.dashOffset.value -= delta * 5)
      );
    }
  });

  const lines = useMemo<Line[]>(() => {
    if (hoveredEventId == null) return [];
    const hoveredPoint = eventIdToDataMap.get(hoveredEventId);
    if (hoveredPoint == null) return [];
    const hoveredPointRetrievals = hoveredPoint.retrievals ?? [];
    if (hoveredPointRetrievals?.length === 0) return [];
    const lines = hoveredPointRetrievals
      .map((retrieval) => {
        const retrievalPoint = eventIdToDataMap.get(retrieval.documentId);
        if (retrievalPoint == null) return null;
        return [hoveredPoint.position, retrievalPoint.position];
      })
      .filter((line): line is Line => line != null);
    return lines;
  }, [eventIdToDataMap, hoveredEventId]);

  return (
    <group ref={group}>
      {lines.map((line, i) => {
        return (
          <group key={i}>
            <QuadraticBezierLine
              start={line[0]}
              end={line[1]}
              color="white"
              opacity={1}
              transparent
              dashed
              dashScale={50}
              gapSize={20}
              lineWidth={lineWidth}
            />
            <QuadraticBezierLine
              start={line[0]}
              end={line[1]}
              color="white"
              lineWidth={lineWidth / 2}
              transparent
              opacity={0.8}
            />
          </group>
        );
      })}
    </group>
  );
}
