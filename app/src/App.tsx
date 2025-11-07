import { Suspense } from "react";
import { RelayEnvironmentProvider } from "react-relay";

import { CredentialsProvider } from "./contexts/CredentialsContext";
import { FeatureFlagsProvider } from "./contexts/FeatureFlagsContext";
import { FunctionalityProvider } from "./contexts/FunctionalityContext";
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
  return (
    <RelayEnvironmentProvider environment={RelayEnvironment}>
      <GlobalStyles />
      <FeatureFlagsProvider>
        <PreferencesProvider>
          <CredentialsProvider>
            <Suspense>
              <AppRoutes />
            </Suspense>
          </CredentialsProvider>
        </PreferencesProvider>
      </FeatureFlagsProvider>
    </RelayEnvironmentProvider>
  );
}
