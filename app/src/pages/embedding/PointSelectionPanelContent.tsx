import React, { useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { Column } from "react-table";

import { TabPane, Tabs } from "@arizeai/components";

import { Table } from "@phoenix/components/table";
import { usePointCloudStore } from "@phoenix/store";

import { PointSelectionPanelContentQuery } from "./__generated__/PointSelectionPanelContentQuery.graphql";

export function PointSelectionPanelContent() {
  const selectedPointIds = usePointCloudStore(
    (state) => state.selectedPointIds
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

  const allEvents = useMemo(() => {
    const primaryEvents = data.model?.primaryDataset?.events ?? [];
    const referenceEvents = data.model?.referenceDataset?.events ?? [];
    return [...primaryEvents, ...referenceEvents];
  }, [data]);

  const tableData = useMemo(() => {
    return allEvents.map((event) => {
      return {
        actualLabel: event.eventMetadata?.actualLabel,
        predictionLabel: event.eventMetadata?.predictionLabel,
      };
    });
  }, [allEvents]);

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
    // @ts-expect-error add more tabs
    <Tabs>
      <TabPane name="Selection">
        <Table columns={columns} data={tableData} />
      </TabPane>
    </Tabs>
  );
}
