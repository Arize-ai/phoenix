import React from "react";
import { css } from "@emotion/react";

import { EventItem } from "@phoenix/components/pointcloud";
import { usePointCloudContext } from "@phoenix/contexts";
import { DatasetRole } from "@phoenix/types";

import { EventsList, UMAPPointsEntry } from "./types";
type PointSelectionGridProps = {
  events: EventsList;
  eventIdToDataMap: Map<string, UMAPPointsEntry>;
  onItemSelected: (pointId: string) => void;
};

export function PointSelectionGrid(props: PointSelectionGridProps) {
  const { events, eventIdToDataMap, onItemSelected } = props;
  const eventIdToGroup = usePointCloudContext((state) => state.eventIdToGroup);
  const pointGroupColors = usePointCloudContext(
    (state) => state.pointGroupColors
  );
  const selectionGridSize = usePointCloudContext(
    (state) => state.selectionGridSize
  );

  return (
    <div
      css={css`
        flex: 1 1 auto;
        overflow-y: auto;
      `}
      data-testid="grid-view-scroll-container"
    >
      <ul
        data-grid-size={selectionGridSize}
        css={css`
          &[data-grid-size="small"] {
            --grid-item-min-width: 100px;
            --grid-item-height: 100px;
          }
          &[data-grid-size="medium"] {
            --grid-item-min-width: 200px;
            --grid-item-height: 200px;
          }
          &[data-grid-size="large"] {
            --grid-item-min-width: 300px;
            --grid-item-height: 200px;
          }
          padding: var(--px-spacing-lg);
          transition: all 0.2s ease-in-out;
          display: grid;
          grid-template-columns: repeat(
            auto-fill,
            minmax(var(--grid-item-min-width), 1fr)
          );
          flex-wrap: wrap;
          gap: var(--px-spacing-lg);
          & > li {
            min-width: var(--grid-item-min-width);
            height: var(--grid-item-height);
          }
        `}
      >
        {events.map((event, idx) => {
          const data = eventIdToDataMap.get(event.id);
          const { rawData = null, linkToData = null } =
            data?.embeddingMetadata ?? {};
          const { predictionLabel = null, actualLabel = null } =
            data?.eventMetadata ?? {};
          const datasetRole = event.id.includes("PRIMARY")
            ? DatasetRole.primary
            : DatasetRole.reference;
          const group = eventIdToGroup[event.id];
          const color = pointGroupColors[group];
          return (
            <li key={idx}>
              <EventItem
                rawData={rawData}
                linkToData={linkToData}
                datasetRole={datasetRole}
                group={group}
                onClick={() => {
                  onItemSelected(event.id);
                }}
                color={color}
                size={selectionGridSize}
                predictionLabel={predictionLabel}
                actualLabel={actualLabel}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
