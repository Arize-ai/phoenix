import React from "react";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { css } from "@emotion/react";

import { useDatasets, usePointCloudContext } from "@phoenix/contexts";
import { getDatasetRoleFromEventId } from "@phoenix/utils/pointCloudUtils";

import { EventItem } from "./EventItem";

/**
 * The size of the tooltip. E.g. 200px x 200px
 */
const TOOLTIP_SIZE = 200;
/**
 * The offset from the mouse position to the tooltip
 */
const TOOLTIP_OFFSET = 10;

/**
 * Re-used position vector
 */
const vec = new THREE.Vector3();
export const PointCloudPointTooltip = () => {
  const { getDatasetNameByRole } = useDatasets();
  const hoveredEventId = usePointCloudContext((state) => state.hoveredEventId);
  const eventIdToDataMap = usePointCloudContext(
    (state) => state.eventIdToDataMap
  );
  const pointData = usePointCloudContext((state) => state.pointData);
  const pointGroupColors = usePointCloudContext(
    (state) => state.pointGroupColors
  );
  const eventIdToGroup = usePointCloudContext((state) => state.eventIdToGroup);
  if (hoveredEventId == null || pointData == null || pointData == null)
    return null;

  // The raw event from the first query
  const baseEvent = eventIdToDataMap.get(hoveredEventId);
  const eventDetails = pointData[hoveredEventId];
  // Show nothing if everything is not loaded
  if (baseEvent == null || eventDetails == null) return null;
  const group = eventIdToGroup[hoveredEventId];
  const color = pointGroupColors[eventIdToGroup[hoveredEventId]];
  const datasetRole = getDatasetRoleFromEventId(hoveredEventId);
  const datasetName = getDatasetNameByRole(datasetRole);
  return (
    <Html
      position={baseEvent.position}
      pointerEvents="none"
      zIndexRange={[0, 1]}
      calculatePosition={(el, camera, size) => {
        const objectPos = vec.setFromMatrixPosition(el.matrixWorld);
        objectPos.project(camera);
        const widthHalf = size.width / 2;
        const heightHalf = size.height / 2;
        return [
          Math.min(
            size.width - TOOLTIP_SIZE - TOOLTIP_OFFSET,
            Math.max(0, objectPos.x * widthHalf + widthHalf + TOOLTIP_OFFSET)
          ),
          Math.min(
            size.height - TOOLTIP_SIZE - TOOLTIP_OFFSET,
            Math.max(
              0,
              -(objectPos.y * heightHalf) + heightHalf + TOOLTIP_OFFSET
            )
          ),
        ];
      }}
    >
      <div
        css={css`
          --grid-item-min-width: ${TOOLTIP_SIZE}px;
          width: ${TOOLTIP_SIZE}px;
          height: ${TOOLTIP_SIZE}px;
          background-color: var(--ac-global-background-color-dark);
          border-radius: var(--ac-global-rounding-medium);
        `}
      >
        <EventItem
          rawData={baseEvent.embeddingMetadata.rawData}
          linkToData={baseEvent.embeddingMetadata.linkToData}
          predictionLabel={baseEvent.eventMetadata.predictionLabel}
          actualLabel={baseEvent.eventMetadata.actualLabel}
          promptAndResponse={eventDetails.promptAndResponse}
          documentText={eventDetails.documentText}
          datasetName={datasetName}
          group={group}
          color={color}
          size={"medium"}
        />
      </div>
    </Html>
  );
};
