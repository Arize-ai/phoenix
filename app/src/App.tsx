import { Suspense } from "react";
import { RelayEnvironmentProvider } from "react-relay";

import { Provider } from "@arizeai/components";

import { ToastRegion } from "./components/toast/ToastRegion";
import { CredentialsProvider } from "./contexts/CredentialsContext";
import { FeatureFlagsProvider } from "./contexts/FeatureFlagsContext";
import { FunctionalityProvider } from "./contexts/FunctionalityContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import { PreferencesProvider } from "./contexts/PreferencesContext";
import { ThemeProvider, useTheme } from "./contexts";
import { GlobalStyles } from "./GlobalStyles";
import RelayEnvironment from "./RelayEnvironment";
import { AppRoutes } from "./Routes";

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
                  <ToastRegion />
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
