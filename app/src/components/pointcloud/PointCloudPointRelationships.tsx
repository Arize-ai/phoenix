import React, { useRef } from "react";
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
  if (hoveredEventId == null) return null;
  debugger;
  const hoveredPoint = eventIdToDataMap.get(hoveredEventId);

  if (hoveredPoint == null) return null;

  const hoveredPointRelationships = hoveredPoint.relationships;

  if (hoveredPointRelationships == null) return null;
  const lines: Line[] = Object.keys(hoveredPointRelationships).reduce(
    (acc, relationshipName) => {
      const relationshipDefinition =
        hoveredPointRelationships[relationshipName];

      relationshipDefinition.forEach((targetEventId) => {
        const targetEvent = eventIdToDataMap.get(targetEventId);
        if (targetEvent == null) return acc;
        acc = [...acc, [hoveredPoint.position, targetEvent.position]];
      });
      return acc;
    },
    [] as Line[]
  );
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
