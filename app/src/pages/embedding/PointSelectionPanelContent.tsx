import React, { useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { css } from "@emotion/react";

import {
  Button,
  CloseOutline,
  Dialog,
  DialogContainer,
  Icon,
  TabPane,
  Tabs,
  Text,
} from "@arizeai/components";

import { Toolbar } from "@phoenix/components/filter";
import {
  EventItem,
  SelectionDisplayRadioGroup,
} from "@phoenix/components/pointcloud";
import { SelectionDisplay } from "@phoenix/constants/pointCloudConstants";
import { usePointCloudContext } from "@phoenix/contexts";
import { DatasetRole } from "@phoenix/types";

import {
  PointSelectionPanelContentQuery,
  PointSelectionPanelContentQuery$data,
} from "./__generated__/PointSelectionPanelContentQuery.graphql";
import { EventDetails } from "./EventDetails";
import { ExportSelectionButton } from "./ExportSelectionButton";
import { PointSelectionTable } from "./PointSelectionTable";
import { ModelEvent, UMAPPointsEntry } from "./types";

type EventsList =
  PointSelectionPanelContentQuery$data["model"]["primaryDataset"]["events"];

export function PointSelectionPanelContent(props: {
  eventIdToDataMap: Map<string, UMAPPointsEntry>;
}) {
  const { eventIdToDataMap } = props;
  const selectedEventIds = usePointCloudContext(
    (state) => state.selectedEventIds
  );
  const setSelectedEventIds = usePointCloudContext(
    (state) => state.setSelectedEventIds
  );
  const setSelectedClusterId = usePointCloudContext(
    (state) => state.setSelectedClusterId
  );
  const { selectionDisplay, setSelectionDisplay } = usePointCloudContext(
    (state) => ({
      selectionDisplay: state.selectionDisplay,
      setSelectionDisplay: state.setSelectionDisplay,
    })
  );
  const [selectedDetailPointId, setSelectedDetailPointId] = React.useState<
    string | null
  >(null);

  const { primaryEventIds, referenceEventIds } = useMemo(() => {
    const primaryEventIds: string[] = [];
    const referenceEventIds: string[] = [];
    selectedEventIds.forEach((id) => {
      if (id.includes("PRIMARY")) {
        primaryEventIds.push(id);
      } else {
        referenceEventIds.push(id);
      }
    });
    return { primaryEventIds, referenceEventIds };
  }, [selectedEventIds]);
  const data = useLazyLoadQuery<PointSelectionPanelContentQuery>(
    graphql`
      query PointSelectionPanelContentQuery(
        $primaryEventIds: [ID!]!
        $referenceEventIds: [ID!]!
      ) {
        model {
          primaryDataset {
            events(eventIds: $primaryEventIds) {
              id
              dimensions {
                dimension {
                  name
                  type
                }
                value
              }
              eventMetadata {
                predictionLabel
                actualLabel
              }
            }
          }
          referenceDataset {
            events(eventIds: $referenceEventIds) {
              id
              dimensions {
                dimension {
                  name
                  type
                }
                value
              }
              eventMetadata {
                predictionLabel
                actualLabel
              }
            }
          }
        }
      }
    `,
    {
      primaryEventIds: [...primaryEventIds],
      referenceEventIds: [...referenceEventIds],
    }
  );

  const allSelectedEvents = useMemo(() => {
    const primaryEvents = data.model?.primaryDataset?.events ?? [];
    const referenceEvents = data.model?.referenceDataset?.events ?? [];
    return [...primaryEvents, ...referenceEvents];
  }, [data]);

  const onClose = () => {
    setSelectedEventIds(new Set());
    setSelectedClusterId(null);
  };

  const allData: ModelEvent[] = useMemo(() => {
    return allSelectedEvents.map((event) => {
      const pointData = eventIdToDataMap.get(event.id);
      return {
        id: event.id,
        actualLabel: event.eventMetadata?.actualLabel ?? null,
        predictionLabel: event.eventMetadata?.predictionLabel ?? null,
        rawData: pointData?.embeddingMetadata.rawData ?? null,
        linkToData: pointData?.embeddingMetadata.linkToData ?? null,
        dimensions: event.dimensions,
      };
    });
  }, [allSelectedEvents, eventIdToDataMap]);

  const eventDetails: ModelEvent | null = useMemo(() => {
    if (selectedDetailPointId) {
      const event = allData.find((event) => event.id === selectedDetailPointId);
      return event ?? null;
    }
    return null;
  }, [allData, selectedDetailPointId]);

  return (
    <section css={pointSelectionPanelCSS}>
      <div
        role="toolbar"
        css={css`
          position: absolute;
          top: var(--px-spacing-med);
          right: var(--px-spacing-lg);
          display: flex;
          flex-direction: row-reverse;
          gap: var(--px-spacing-med);
        `}
      >
        <Button
          variant="default"
          size="compact"
          icon={<Icon svg={<CloseOutline />} />}
          aria-label="Clear selection"
          onClick={onClose}
        />
        <ExportSelectionButton />
      </div>
      {/* @ts-expect-error more tabs to come */}
      <Tabs>
        <TabPane name="Selection">
          <Toolbar
            extra={
              <SelectionDisplayRadioGroup
                mode={selectionDisplay}
                onChange={(displayMode) => {
                  setSelectionDisplay(displayMode);
                }}
              />
            }
          >
            <Text>{`${allSelectedEvents.length} points selected`}</Text>
          </Toolbar>
          {selectionDisplay === SelectionDisplay.list ? (
            <div
              css={css`
                flex: 1 1 auto;
                overflow-y: auto;
              `}
            >
              <PointSelectionTable
                data={allData}
                onPointSelected={setSelectedDetailPointId}
              />
            </div>
          ) : (
            <SelectionGridView
              events={allSelectedEvents}
              eventIdToDataMap={eventIdToDataMap}
              onItemSelected={setSelectedDetailPointId}
            />
          )}
        </TabPane>
      </Tabs>
      <DialogContainer
        type="slideOver"
        isDismissable
        onDismiss={() => setSelectedDetailPointId(null)}
      >
        {eventDetails && (
          <Dialog title="Embedding Details" size="L">
            <EventDetails event={eventDetails} />
          </Dialog>
        )}
      </DialogContainer>
    </section>
  );
}

type SelectionGridViewProps = {
  events: EventsList;
  eventIdToDataMap: Map<string, UMAPPointsEntry>;
  onItemSelected: (pointId: string) => void;
};

const pointSelectionPanelCSS = css`
  width: 100%;
  height: 100%;
  position: relative;
  display: flex;
  flex-direction: column;
  /* Give spacing for the close icon */
  & > .ac-tabs {
    padding-top: 17px;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    [role="tablist"] {
      flex: none;
    }
    .ac-tabs__pane-container {
      display: flex;
      flex-direction: column;
      flex: 1 1 auto;
      overflow: hidden;
      [role="tabpanel"] {
        display: flex;
        flex-direction: column;
        flex: 1 1 auto;
        overflow: hidden;
      }
    }
  }
`;

function SelectionGridView(props: SelectionGridViewProps) {
  const { events, eventIdToDataMap, onItemSelected } = props;
  const eventIdToGroup = usePointCloudContext((state) => state.eventIdToGroup);
  const pointGroupColors = usePointCloudContext(
    (state) => state.pointGroupColors
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
        css={css`
          padding: var(--px-spacing-lg);
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
          flex-wrap: wrap;
          gap: var(--px-spacing-lg);
          & > li {
            min-width: 160px;
            min-height: 168px;
          }
        `}
      >
        {events.map((event, idx) => {
          const data = eventIdToDataMap.get(event.id);
          const { rawData = null, linkToData = null } =
            data?.embeddingMetadata ?? {};
          const datasetRole = event.id.includes("PRIMARY")
            ? DatasetRole.primary
            : DatasetRole.reference;
          const color = pointGroupColors[eventIdToGroup[event.id]];
          return (
            <li key={idx}>
              <EventItem
                rawData={rawData}
                linkToData={linkToData}
                datasetRole={datasetRole}
                onClick={() => {
                  onItemSelected(event.id);
                }}
                color={color}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
