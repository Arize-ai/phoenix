import React, { useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { Column } from "react-table";
import { css } from "@emotion/react";

import { Button, CloseOutline, Icon, TabPane, Tabs } from "@arizeai/components";

import { SelectionDisplayRadioGroup } from "@phoenix/components/canvas";
import { EventItem } from "@phoenix/components/event";
import { Toolbar } from "@phoenix/components/filter";
import { Table } from "@phoenix/components/table";
import { usePointCloudStore } from "@phoenix/store";
import { SelectionDisplay } from "@phoenix/types";

import {
  PointSelectionPanelContentQuery,
  PointSelectionPanelContentQuery$data,
} from "./__generated__/PointSelectionPanelContentQuery.graphql";
import { UMAPPointsEntry } from "./types";

type EventsList =
  PointSelectionPanelContentQuery$data["model"]["primaryDataset"]["events"];

export function PointSelectionPanelContent({
  pointIdToDataMap,
}: {
  pointIdToDataMap: Record<string, UMAPPointsEntry>;
}) {
  const selectedPointIds = usePointCloudStore(
    (state) => state.selectedPointIds
  );
  const setSelectedPointIds = usePointCloudStore(
    (state) => state.setSelectedPointIds
  );
  const { selectionDisplay, setSelectionDisplay } = usePointCloudStore(
    (state) => ({
      selectionDisplay: state.selectionDisplay,
      setSelectionDisplay: state.setSelectionDisplay,
    })
  );

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
  };

  const tableData = useMemo(() => {
    return allSelectedEvents.map((event) => {
      return {
        actualLabel: event.eventMetadata?.actualLabel,
        predictionLabel: event.eventMetadata?.predictionLabel,
      };
    });
  }, [allSelectedEvents]);

  const columns: Column<typeof tableData[number]>[] = [
    {
      Header: "Actual Label",
      accessor: "actualLabel",
    },
    {
      Header: "Prediction Label",
      accessor: "predictionLabel",
    },
  ];

  return (
    <section
      css={css`
        width: 100%;
        height: 100%;
        position: relative;
        /* Give spacing for the close icon */
        & > .ac-tabs {
          padding-top: 17px;
        }
      `}
    >
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
          />
          {selectionDisplay === SelectionDisplay.list ? (
            <Table columns={columns} data={tableData} />
          ) : (
            <SelectionGridView events={allSelectedEvents} />
          )}
        </TabPane>
      </Tabs>
    </section>
  );
}

type SelectionGridViewProps = {
  events: EventsList;
  pointIdToDataMap: Record<string, UMAPPointsEntry>;
};
function SelectionGridView(props: SelectionGridViewProps) {
  const { events } = props;
  return (
    <ul
      css={css`
        margin: var(--px-spacing-lg);
        display: flex;
        flex-direction: row;
        flex-wrap: wrap;
        gap: var(--px-spacing-lg);
        & > li {
          min-width: 200px;
          height: 200px;
        }
      `}
    >
      {events.map((event, idx) => {
        const data = pointIdToDataMap[event.id];
        return (
          <li key={idx}>
            <EventItem rawData={"blabla"} />
          </li>
        );
      })}
    </ul>
  );
}
