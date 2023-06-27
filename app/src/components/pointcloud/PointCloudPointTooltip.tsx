import React from "react";
import { Html } from "@react-three/drei";
import { css } from "@emotion/react";

import { useDatasets, usePointCloudContext } from "@phoenix/contexts";
import { getDatasetRoleFromEventId } from "@phoenix/utils/pointCloudUtils";

import { EventItem } from "./EventItem";

export const PointCloudPointTooltip = () => {
  const { primaryDataset, referenceDataset } = useDatasets();
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
  const datasetName =
    datasetRole === "primary"
      ? primaryDataset.name
      : referenceDataset?.name ?? "reference";
  return (
    <Html position={baseEvent.position} pointerEvents="none">
      <div
        css={css`
          --grid-item-min-width: 200px;
          width: 200px;
          height: 200px;
          background-color: var(--ac-global-background-color-dark);
          border-radius: var(--ac-global-rounding-medium);
          // Give spacing for the cursor
          margin: var(--px-spacing-med);
        `}
      >
        <EventItem
          rawData={baseEvent.embeddingMetadata.rawData}
          linkToData={baseEvent.embeddingMetadata.linkToData}
          predictionLabel={baseEvent.eventMetadata.predictionLabel}
          actualLabel={baseEvent.eventMetadata.actualLabel}
          promptAndResponse={eventDetails.promptAndResponse}
          datasetName={datasetName}
          group={group}
          color={color}
          size={"medium"}
        />
      </div>
    </Html>
  );
};
