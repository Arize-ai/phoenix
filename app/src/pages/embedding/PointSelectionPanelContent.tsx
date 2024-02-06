import React, { useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { css } from "@emotion/react";

import {
  Button,
  CloseOutline,
  CompactSearchField,
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
import { EventData } from "@phoenix/store";

import { PointSelectionPanelContentQuery } from "./__generated__/PointSelectionPanelContentQuery.graphql";
import { EventDetails } from "./EventDetails";
import { ExportSelectionButton } from "./ExportSelectionButton";
import { PointSelectionGrid } from "./PointSelectionGrid";
import { PointSelectionTable } from "./PointSelectionTable";
import { ModelEvent, RetrievalDocument } from "./types";

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

function convertGqlEventToRetrievalDocument({
  event,
  relevance,
}: {
  event: EventData;
  relevance: number | null;
}): RetrievalDocument {
  return {
    id: event.eventMetadata.predictionId || "unknown id",
    text: event.documentText ?? "empty document",
    relevance: relevance,
  };
}

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

  const [selectedDetailPointId, setSelectedDetailPointId] = React.useState<
    string | null
  >(null);

  const { primaryEventIds, referenceEventIds, corpusEventIds } = useMemo(() => {
    const primaryEventIds: string[] = [];
    const referenceEventIds: string[] = [];
    const corpusEventIds: string[] = [];
    selectedEventIds.forEach((id) => {
      if (id.includes("PRIMARY")) {
        primaryEventIds.push(id);
      } else if (id.includes("CORPUS")) {
        corpusEventIds.push(id);
      } else {
        referenceEventIds.push(id);
      }
    });
    return { primaryEventIds, referenceEventIds, corpusEventIds };
  }, [selectedEventIds]);
  const data = useLazyLoadQuery<PointSelectionPanelContentQuery>(
    graphql`
      query PointSelectionPanelContentQuery(
        $primaryEventIds: [ID!]!
        $referenceEventIds: [ID!]!
        $corpusEventIds: [ID!]!
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
                predictionId
                predictionLabel
                predictionScore
                actualLabel
                actualScore
              }
              promptAndResponse {
                prompt
                response
              }
              documentText
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
                predictionId
                predictionLabel
                predictionScore
                actualLabel
                actualScore
              }
              promptAndResponse {
                prompt
                response
              }
              documentText
            }
          }
          corpusDataset {
            events(eventIds: $corpusEventIds) {
              id
              dimensions {
                dimension {
                  name
                  type
                }
                value
              }
              eventMetadata {
                predictionId
                predictionLabel
                predictionScore
                actualLabel
                actualScore
              }
              promptAndResponse {
                prompt
                response
              }
              documentText
            }
          }
        }
      }
    `,
    {
      primaryEventIds: [...primaryEventIds],
      referenceEventIds: [...referenceEventIds],
      corpusEventIds: [...corpusEventIds],
    }
  );

  const allSelectedEvents = useMemo(() => {
    const primaryEvents = data.model?.primaryDataset?.events ?? [];
    const referenceEvents = data.model?.referenceDataset?.events ?? [];
    const corpusEvents = data.model?.corpusDataset?.events ?? [];
    return [...primaryEvents, ...referenceEvents, ...corpusEvents];
  }, [data]);

  const onClose = () => {
    setSelectedEventIds(new Set());
    setSelectedClusterId(null);
  };

  const eventIdToDataMap = usePointCloudContext(
    (state) => state.eventIdToDataMap
  );
  const pointData = usePointCloudContext((state) => state.pointData);
  const selectionSearchText = usePointCloudContext(
    (state) => state.selectionSearchText
  );
  const allData: ModelEvent[] = useMemo(() => {
    return allSelectedEvents.map((event) => {
      const point = eventIdToDataMap.get(event.id);
      const documents: RetrievalDocument[] = [];
      if (pointData != null && point?.retrievals != null) {
        point.retrievals.forEach(({ documentId, relevance }) => {
          const documentEvent = pointData[documentId];
          if (documentEvent != null) {
            documents.push(
              convertGqlEventToRetrievalDocument({
                event: documentEvent,
                relevance,
              })
            );
          }
        });
      }

      return {
        id: event.id,
        predictionId: event.eventMetadata?.predictionId ?? null,
        actualLabel: event.eventMetadata?.actualLabel ?? null,
        actualScore: event.eventMetadata?.actualScore ?? null,
        predictionLabel: event.eventMetadata?.predictionLabel ?? null,
        predictionScore: event.eventMetadata?.predictionScore ?? null,
        rawData: point?.embeddingMetadata.rawData ?? null,
        linkToData: point?.embeddingMetadata.linkToData ?? null,
        dimensions: event.dimensions,
        prompt: event.promptAndResponse?.prompt ?? null,
        response: event.promptAndResponse?.response ?? null,
        retrievedDocuments: documents,
        documentText: event.documentText ?? null,
      };
    });
  }, [allSelectedEvents, eventIdToDataMap, pointData]);

  const filteredData = useMemo(() => {
    if (selectionSearchText) {
      const lowerCaseSearchText = selectionSearchText.toLowerCase();
      return allData.filter((event) => {
        return (
          event.id.includes(lowerCaseSearchText) ||
          event.documentText?.toLowerCase().includes(lowerCaseSearchText) ||
          event.predictionId?.includes(lowerCaseSearchText) ||
          event.prompt?.toLowerCase().includes(lowerCaseSearchText) ||
          event.response?.toLowerCase().includes(lowerCaseSearchText)
        );
      });
    }
    return allData;
  }, [allData, selectionSearchText]);

  const filteredEvents = useMemo(() => {
    if (selectionSearchText) {
      const lowerCaseSearchText = selectionSearchText.toLowerCase();
      return allSelectedEvents.filter((event) => {
        return (
          event.id.includes(lowerCaseSearchText) ||
          event.documentText?.toLowerCase().includes(lowerCaseSearchText) ||
          event.eventMetadata?.predictionId?.includes(lowerCaseSearchText) ||
          event.promptAndResponse?.prompt
            ?.toLowerCase()
            .includes(lowerCaseSearchText) ||
          event.promptAndResponse?.response
            ?.toLowerCase()
            .includes(lowerCaseSearchText)
        );
      });
    }
    return allSelectedEvents;
  }, [allSelectedEvents, selectionSearchText]);

  const eventDetails: ModelEvent | null = useMemo(() => {
    if (selectedDetailPointId) {
      const event = allData.find((event) => event.id === selectedDetailPointId);
      return event ?? null;
    }
    return null;
  }, [allData, selectedDetailPointId]);

  const numSelectedEvents = allSelectedEvents.length;
  const numMatchingEvents = filteredEvents.length;

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
          <SelectionToolbar
            numSelectedEvents={numSelectedEvents}
            numMatchingEvents={numMatchingEvents}
            searchText={selectionSearchText}
          />
          {selectionDisplay === SelectionDisplay.list ? (
            <div
              css={css`
                flex: 1 1 auto;
                overflow-y: auto;
              `}
            >
              <PointSelectionTable
                data={filteredData}
                onPointSelected={setSelectedDetailPointId}
              />
            </div>
          ) : (
            <PointSelectionGrid
              events={filteredEvents}
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

function SelectionToolbar({
  numSelectedEvents,
  numMatchingEvents,
  searchText,
}: {
  numSelectedEvents: number;
  /**
   * The number of events that match the current search
   */
  numMatchingEvents: number;
  /**
   * The current search text
   */
  searchText: string;
}) {
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
  const setSelectionSearchText = usePointCloudContext(
    (state) => state.setSelectionSearchText
  );
  const summaryText = useMemo(() => {
    if (!searchText) {
      return `${numSelectedEvents} selected`;
    }
    return `${numMatchingEvents}/${numSelectedEvents} match "${searchText}"`;
  }, [numSelectedEvents, numMatchingEvents, searchText]);
  return (
    <Toolbar
      extra={
        <div
          css={css`
            display: flex;
            flex-direction: row;
            gap: var(--px-spacing-med);
          `}
        >
          <CompactSearchField
            placeholder="Search by text or ID"
            onChange={(searchText) => {
              setSelectionSearchText(searchText);
            }}
          />
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
      <Text>{summaryText}</Text>
    </Toolbar>
  );
}
