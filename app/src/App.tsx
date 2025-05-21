import { Suspense } from "react";
import { RelayEnvironmentProvider } from "react-relay";

import { Provider } from "@arizeai/components";

import { CredentialsProvider } from "./contexts/CredentialsContext";
import { FeatureFlagsProvider } from "./contexts/FeatureFlagsContext";
import { FunctionalityProvider } from "./contexts/FunctionalityContext";
import { PreferencesProvider } from "./contexts/PreferencesContext";
import { NotificationProvider, ThemeProvider, useTheme } from "./contexts";
import { GlobalStyles } from "./GlobalStyles";
import RelayEnvironment from "./RelayEnvironment";
import { AppRoutes } from "./Routes";

import "normalize.css";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

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
    <Provider theme={componentsTheme} mountGlobalStyles={false}>
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
    </Provider>
  );
}
