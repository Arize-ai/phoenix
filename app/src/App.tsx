import { Provider, theme } from "@arizeai/components";
import React, { Suspense } from "react";
import { GlobalStyles } from "./GlobalStyles";
import { ThemeProvider } from "@emotion/react";
import {
  PreloadedQuery,
  RelayEnvironmentProvider,
  graphql,
  loadQuery,
  usePreloadedQuery,
} from "react-relay";
import RelayEnvironment from "./RelayEnvironment";
import { AppRootQuery } from "./__generated__/AppRootQuery.graphql";
import { AppRoutes } from "./Routes";
import { DatasetsProvider } from "./contexts";
import { TimeRangeProvider } from "./contexts/TimeRangeContext";

const RootQuery = graphql`
  query AppRootQuery {
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
    }
  }
`;

type AppProps = {
  preloadedQuery: PreloadedQuery<AppRootQuery>;
};

function App(props: AppProps) {
  const {
    model: { primaryDataset, referenceDataset },
  } = usePreloadedQuery(RootQuery, props.preloadedQuery);

  return (
    <DatasetsProvider
      primaryDataset={primaryDataset}
      referenceDataset={referenceDataset ?? null}
    >
      <TimeRangeProvider
        timeRangeBounds={{
          start: new Date(primaryDataset.startTime),
          end: new Date(primaryDataset.endTime),
        }}
      >
        <AppRoutes />
      </TimeRangeProvider>
    </DatasetsProvider>
  );
}

export function AppRoot() {
  const preloadedQuery = loadQuery<AppRootQuery>(
    RelayEnvironment,
    RootQuery,
    {}
  );
  return (
    <Provider>
      <ThemeProvider theme={theme}>
        <RelayEnvironmentProvider environment={RelayEnvironment}>
          <GlobalStyles />
          <Suspense>
            <App preloadedQuery={preloadedQuery} />
          </Suspense>
        </RelayEnvironmentProvider>
      </ThemeProvider>
    </Provider>
  );
}
