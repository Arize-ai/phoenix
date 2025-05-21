import { graphql, useLazyLoadQuery } from "react-relay";
import { Outlet } from "react-router";

import { InferencesProvider, TimeRangeProvider } from "@phoenix/contexts";

import { ModelRootQuery } from "./__generated__/ModelRootQuery.graphql";

const RootQuery = graphql`
  query ModelRootQuery {
    model {
      primaryInferences {
        name
        startTime
        endTime
      }
      referenceInferences {
        name
        startTime
        endTime
      }
      corpusInferences {
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
    model: { primaryInferences, referenceInferences, corpusInferences },
  } = data;

  return (
    <InferencesProvider
      primaryInferences={primaryInferences}
      referenceInferences={referenceInferences ?? null}
      corpusInferences={corpusInferences ?? null}
    >
      <TimeRangeProvider
        timeRangeBounds={{
          start: new Date(primaryInferences.startTime),
          end: new Date(primaryInferences.endTime),
        }}
      >
        <Outlet />
      </TimeRangeProvider>
    </InferencesProvider>
  );
}
