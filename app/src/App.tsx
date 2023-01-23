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
import { DatasetsProvider, useDatasets } from "./contexts";
import { Brand, Navbar } from "./components/nav";

const RootQuery = graphql`
  query AppRootQuery {
    primaryDataset {
      name
    }
    referenceDataset {
      name
    }
  }
`;

type AppProps = {
  preloadedQuery: PreloadedQuery<AppRootQuery>;
};

function Nav() {
  const datasets = useDatasets();
  return (
    <Navbar>
      <Brand />
      <span>{datasets.primaryDataset.name}</span>
      <span>{datasets.referenceDataset.name}</span>
    </Navbar>
  );
}

function App(props: AppProps) {
  const data = usePreloadedQuery(RootQuery, props.preloadedQuery);
  return (
    <DatasetsProvider
      primaryDataset={data.primaryDataset}
      referenceDataset={data.referenceDataset}
    >
      <Nav />
      <AppRoutes />
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
          <Suspense fallback={"Loading..."}>
            <App preloadedQuery={preloadedQuery} />
          </Suspense>
        </RelayEnvironmentProvider>
      </ThemeProvider>
    </Provider>
  );
}
