import React, { Suspense } from "react";
import { RelayEnvironmentProvider } from "react-relay";
import { ThemeProvider } from "@emotion/react";

import { Provider, theme } from "@arizeai/components";

import { NotificationProvider } from "./contexts";
import { GlobalStyles } from "./GlobalStyles";
import RelayEnvironment from "./RelayEnvironment";
import { AppRoutes } from "./Routes";

import "normalize.css";

const componentsTheme =
  localStorage.getItem("theme") == "light" ? "light" : "dark";

export function App() {
  return (
    <Provider theme={componentsTheme}>
      <ThemeProvider theme={theme}>
        <RelayEnvironmentProvider environment={RelayEnvironment}>
          <GlobalStyles />
          <Suspense>
            <NotificationProvider>
              <AppRoutes />
            </NotificationProvider>
          </Suspense>
        </RelayEnvironmentProvider>
      </ThemeProvider>
    </Provider>
  );
}
