import React from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { Outlet } from "react-router-dom";

import { DatasetsProvider, TimeRangeProvider } from "@phoenix/contexts";

import { ModelRootQuery } from "./__generated__/ModelRootQuery.graphql";

const RootQuery = graphql`
  query ModelRootQuery {
    model {
      primaryDataset {
        name
        startTime
        endTime
      }
      referenceDataset {
        name
        startTime
        endTime
      }
      corpusDataset {
        name
        startTime
        endTime
      }
    }
  }
`;

/**
 * The root entry point for all things related to a single model.
 */
export function ModelRoot() {
  const data = useLazyLoadQuery<ModelRootQuery>(RootQuery, {});
  const {
    model: { primaryDataset, referenceDataset, corpusDataset },
  } = data;

  return (
    <DatasetsProvider
      primaryDataset={primaryDataset}
      referenceDataset={referenceDataset ?? null}
      corpusDataset={corpusDataset ?? null}
    >
      <TimeRangeProvider
        timeRangeBounds={{
          start: new Date(primaryDataset.startTime),
          end: new Date(primaryDataset.endTime),
        }}
      >
        <Outlet />
      </TimeRangeProvider>
    </DatasetsProvider>
  );
}
