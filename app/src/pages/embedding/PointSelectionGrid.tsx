import { css } from "@emotion/react";

import { EventItem } from "@phoenix/components/pointcloud";
import { useInferences, usePointCloudContext } from "@phoenix/contexts";
import { getInferencesRoleFromEventId } from "@phoenix/utils/pointCloudUtils";

import { EventsList } from "./types";
type PointSelectionGridProps = {
  events: EventsList;
  onItemSelected: (pointId: string) => void;
};

export function PointSelectionGrid(props: PointSelectionGridProps) {
  const { getInferencesNameByRole } = useInferences();
  const { events, onItemSelected } = props;
  const eventIdToDataMap = usePointCloudContext(
    (state) => state.eventIdToDataMap
  );
  const eventIdToGroup = usePointCloudContext((state) => state.eventIdToGroup);
  const pointGroupColors = usePointCloudContext(
    (state) => state.pointGroupColors
  );
  const selectionGridSize = usePointCloudContext(
    (state) => state.selectionGridSize
  );
  const setHoveredEventId = usePointCloudContext(
    (state) => state.setHoveredEventId
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
          padding: var(--ac-global-dimension-static-size-200);
          transition: all 0.2s ease-in-out;
          display: grid;
          grid-template-columns: repeat(
            auto-fill,
            minmax(var(--grid-item-min-width), 1fr)
          );
          flex-wrap: wrap;
          gap: var(--ac-global-dimension-static-size-200);
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
          const inferencesRole = getInferencesRoleFromEventId(event.id);
          const inferencesName = getInferencesNameByRole(inferencesRole);
          const group = eventIdToGroup[event.id];
          const color = pointGroupColors[group];

          return (
            <li key={idx}>
              <EventItem
                rawData={rawData}
                linkToData={linkToData}
                inferencesName={inferencesName}
                group={group}
                onClick={() => {
                  onItemSelected(event.id);
                }}
                onMouseOver={() => {
                  setHoveredEventId(event.id);
                }}
                onMouseOut={() => {
                  setHoveredEventId(null);
                }}
                color={color}
                size={selectionGridSize}
                predictionLabel={predictionLabel}
                actualLabel={actualLabel}
                promptAndResponse={event.promptAndResponse}
                documentText={event.documentText}
                autoPlay={false}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
