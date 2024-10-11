import React, { Suspense } from "react";
import { RelayEnvironmentProvider } from "react-relay";
import { ThemeProvider as EmotionThemeProvider } from "@emotion/react";

import { Provider, theme } from "@arizeai/components";

import { CredentialsProvider } from "./contexts/CredentialsContext";
import { FeatureFlagsProvider } from "./contexts/FeatureFlagsContext";
import { FunctionalityProvider } from "./contexts/FunctionalityContext";
import { PreferencesProvider } from "./contexts/PreferencesContext";
import { NotificationProvider, ThemeProvider, useTheme } from "./contexts";
import { GlobalStyles } from "./GlobalStyles";
import RelayEnvironment from "./RelayEnvironment";
import { AppRoutes } from "./Routes";

import "normalize.css";

export function App() {
  return (
    <FunctionalityProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </FunctionalityProvider>
  );
}

export function AppContent() {
  const { theme: componentsTheme } = useTheme();
  return (
    <Provider theme={componentsTheme}>
      <EmotionThemeProvider theme={theme}>
        <RelayEnvironmentProvider environment={RelayEnvironment}>
          <GlobalStyles />
          <FeatureFlagsProvider>
            <PreferencesProvider>
              <CredentialsProvider>
                <Suspense>
                  <NotificationProvider>
                    <AppRoutes />
                  </NotificationProvider>
                </Suspense>
              </CredentialsProvider>
            </PreferencesProvider>
          </FeatureFlagsProvider>
        </RelayEnvironmentProvider>
      </EmotionThemeProvider>
    </Provider>
  );
}
