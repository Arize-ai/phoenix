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
import { SelectionDisplayRadioGroup } from "@phoenix/components/pointcloud";
import { SelectionGridSizeRadioGroup } from "@phoenix/components/pointcloud/SelectionGridSizeRadioGroup";
import { SelectionDisplay } from "@phoenix/constants/pointCloudConstants";
import { usePointCloudContext } from "@phoenix/contexts";

import { PointSelectionPanelContentQuery } from "./__generated__/PointSelectionPanelContentQuery.graphql";
import { EventDetails } from "./EventDetails";
import { ExportSelectionButton } from "./ExportSelectionButton";
import { PointSelectionGrid } from "./PointSelectionGrid";
import { PointSelectionTable } from "./PointSelectionTable";
import { ModelEvent } from "./types";

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

export function PointSelectionPanelContent() {
  const selectedEventIds = usePointCloudContext(
    (state) => state.selectedEventIds
  );
  const setSelectedEventIds = usePointCloudContext(
    (state) => state.setSelectedEventIds
  );
  const setSelectedClusterId = usePointCloudContext(
    (state) => state.setSelectedClusterId
  );
  const selectionDisplay = usePointCloudContext(
    (state) => state.selectionDisplay
  );
  const setSelectionDisplay = usePointCloudContext(
    (state) => state.setSelectionDisplay
  );
  const selectionGridSize = usePointCloudContext(
    (state) => state.selectionGridSize
  );
  const setSelectionGridSize = usePointCloudContext(
    (state) => state.setSelectionGridSize
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
              promptAndResponse {
                prompt
                response
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
              promptAndResponse {
                prompt
                response
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

  const eventIdToDataMap = usePointCloudContext(
    (state) => state.eventIdToDataMap
  );

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
        prompt: event.promptAndResponse?.prompt ?? null,
        response: event.promptAndResponse?.response ?? null,
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
              <div
                css={css`
                  display: flex;
                  flex-direction: row;
                  gap: var(--px-spacing-med);
                `}
              >
                {selectionDisplay === SelectionDisplay.gallery && (
                  <SelectionGridSizeRadioGroup
                    size={selectionGridSize}
                    onChange={setSelectionGridSize}
                  />
                )}
                <SelectionDisplayRadioGroup
                  mode={selectionDisplay}
                  onChange={(displayMode) => {
                    setSelectionDisplay(displayMode);
                  }}
                />
              </div>
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
            <PointSelectionGrid
              events={allSelectedEvents}
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
