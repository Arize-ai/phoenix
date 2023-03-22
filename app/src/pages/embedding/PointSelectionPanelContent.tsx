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
import { DatasetType } from "@phoenix/types";

import {
  PointSelectionPanelContentQuery,
  PointSelectionPanelContentQuery$data,
} from "./__generated__/PointSelectionPanelContentQuery.graphql";
import { EventDetails } from "./EventDetails";
import { PointSelectionTable } from "./PointSelectionTable";
import { ModelEvent, UMAPPointsEntry } from "./types";

type EventsList =
  PointSelectionPanelContentQuery$data["model"]["primaryDataset"]["events"];

export function PointSelectionPanelContent(props: {
  pointIdToDataMap: Map<string, UMAPPointsEntry>;
}) {
  const { pointIdToDataMap } = props;
  const selectedPointIds = usePointCloudContext(
    (state) => state.selectedPointIds
  );
  const setSelectedPointIds = usePointCloudContext(
    (state) => state.setSelectedPointIds
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
    selectedPointIds.forEach((id) => {
      if (id.includes("PRIMARY")) {
        primaryEventIds.push(id);
      } else {
        referenceEventIds.push(id);
      }
    });
    return { primaryEventIds, referenceEventIds };
  }, [selectedPointIds]);
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
    setSelectedPointIds(new Set());
    setSelectedClusterId(null);
  };

  const allData: ModelEvent[] = useMemo(() => {
    return allSelectedEvents.map((event) => {
      const pointData = pointIdToDataMap.get(event.id);
      return {
        id: event.id,
        actualLabel: event.eventMetadata?.actualLabel ?? null,
        predictionLabel: event.eventMetadata?.predictionLabel ?? null,
        rawData: pointData?.embeddingMetadata.rawData ?? null,
        linkToData: pointData?.embeddingMetadata.linkToData ?? null,
        dimensions: event.dimensions,
      };
    });
  }, [allSelectedEvents, pointIdToDataMap]);

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
        `}
      >
        <Button
          variant="default"
          size="compact"
          icon={<Icon svg={<CloseOutline />} />}
          aria-label="Clear selection"
          onClick={onClose}
        />
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
              pointIdToDataMap={pointIdToDataMap}
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
  pointIdToDataMap: Map<string, UMAPPointsEntry>;
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
  const { events, pointIdToDataMap, onItemSelected } = props;
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
          const data = pointIdToDataMap.get(event.id);
          const { rawData = null, linkToData = null } =
            data?.embeddingMetadata ?? {};
          const datasetType = event.id.includes("PRIMARY")
            ? DatasetType.primary
            : DatasetType.reference;
          return (
            <li key={idx}>
              <EventItem
                rawData={rawData}
                linkToData={linkToData}
                datasetType={datasetType}
                onClick={() => {
                  onItemSelected(event.id);
                }}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
