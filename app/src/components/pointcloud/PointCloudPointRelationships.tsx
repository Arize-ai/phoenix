import { QuadraticBezierLine } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
// @ts-expect-error - this module will be deleted soon
import THREE from "three";

import { usePointCloudContext } from "@phoenix/contexts/PointCloudContext";

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
        // @ts-expect-error - this module will be deleted soon
        (group) =>
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
              color={0xffffff}
              opacity={1}
              transparent
              dashed
              dashScale={50}
              gapSize={20}
              linewidth={lineWidth}
            />
            <QuadraticBezierLine
              start={line[0]}
              end={line[1]}
              color={0xffffff}
              linewidth={lineWidth / 2}
              transparent
              opacity={0.8}
            />
          </group>
        );
      })}
    </group>
  );
}
