import React, { Suspense } from "react";
import { RelayEnvironmentProvider } from "react-relay";
import { ThemeProvider as EmotionThemeProvider } from "@emotion/react";

import { Provider, theme } from "@arizeai/components";

import { NotificationProvider, ThemeProvider, useTheme } from "./contexts";
import { GlobalStyles } from "./GlobalStyles";
import RelayEnvironment from "./RelayEnvironment";
import { AppRoutes } from "./Routes";

import "normalize.css";

export function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

export function AppContent() {
  const { theme: componentsTheme } = useTheme();
  return (
    <Provider theme={componentsTheme}>
      <EmotionThemeProvider theme={theme}>
        <RelayEnvironmentProvider environment={RelayEnvironment}>
          <GlobalStyles />
          <Suspense>
            <NotificationProvider>
              <AppRoutes />
            </NotificationProvider>
          </Suspense>
        </RelayEnvironmentProvider>
      </EmotionThemeProvider>
    </Provider>
  );
}
