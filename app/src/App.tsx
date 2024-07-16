import React, { Suspense } from "react";
import { RelayEnvironmentProvider } from "react-relay";
import { ThemeProvider as EmotionThemeProvider } from "@emotion/react";

import { Provider, theme } from "@arizeai/components";

import { FeatureFlagsProvider } from "./contexts/FeatureFlagsContext";
import { PreferencesProvider } from "./contexts/PreferencesContext";
import { NotificationProvider, ThemeProvider, useTheme } from "./contexts";
import { GlobalStyles } from "./GlobalStyles";
import RelayEnvironment from "./RelayEnvironment";
import { AppRoutes } from "./Routes";

import "normalize.css";

function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

function AppContent() {
  const { theme: componentsTheme } = useTheme();
  return (
    <Provider theme={componentsTheme}>
      <EmotionThemeProvider theme={theme}>
        <RelayEnvironmentProvider environment={RelayEnvironment}>
          <GlobalStyles />
          <FeatureFlagsProvider>
            <PreferencesProvider>
              <Suspense>
                <NotificationProvider>
                  <AppRoutes />
                </NotificationProvider>
              </Suspense>
            </PreferencesProvider>
          </FeatureFlagsProvider>
        </RelayEnvironmentProvider>
      </EmotionThemeProvider>
    </Provider>
  );
}

export default App;
