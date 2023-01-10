/*
 *                    Copyright 2023 Arize AI and contributors.
 *                     Licensed under the Elastic License 2.0;
 *   you may not use this file except in compliance with the Elastic License 2.0.
 */

import { Navbar, Brand } from "./components/nav";
import { Home } from "./pages";
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

function App(props: AppProps) {
  const data = usePreloadedQuery(RootQuery, props.preloadedQuery);
  return (
    <div>
      <Navbar>
        <Brand />
      </Navbar>
      <Home
        primaryDatasetName={data.primaryDataset.name}
        referenceDatasetName={data.referenceDataset.name}
      />
    </div>
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
