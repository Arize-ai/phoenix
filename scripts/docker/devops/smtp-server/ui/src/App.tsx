import { EmailDebugger } from "./components/EmailDebugger.js";
import { ErrorBoundary } from "./components/ErrorBoundary.js";
import { ThemeProvider } from "./contexts/ThemeContext.js";

export default function App() {
  return (
    <ThemeProvider>
      <ErrorBoundary>
        <EmailDebugger />
      </ErrorBoundary>
    </ThemeProvider>
  );
}
