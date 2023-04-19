import React, { Suspense } from "react";
import {
  graphql,
  loadQuery,
  PreloadedQuery,
  RelayEnvironmentProvider,
  usePreloadedQuery,
} from "react-relay";
import { ThemeProvider } from "@emotion/react";

import { Provider, theme } from "@arizeai/components";

import { AppRootQuery } from "./__generated__/AppRootQuery.graphql";
import {
  DatasetsProvider,
  NotificationProvider,
  TimeRangeProvider,
} from "./contexts";
import { GlobalStyles } from "./GlobalStyles";
import RelayEnvironment from "./RelayEnvironment";
import { AppRoutes } from "./Routes";

import "normalize.css";

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
    <NotificationProvider>
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
    </NotificationProvider>
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
