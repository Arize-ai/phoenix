import ReactDom from "react-dom/client";

import { App } from "./App";

/**
 * This is needed to support modulepreload in Vite when using a non HTML custom entrypoint (i.e., this file).
 * We do this because our index.html is served by the Phoenix server
 * @see https://vitejs.dev/config/build-options#build-modulepreload
 */
import "vite/modulepreload-polyfill";
import "normalize.css";

// TEMPORARY: Reset persisted resize preferences on reload while drawer resize
// behavior is under development. Remove this block when that work is complete.
function resetPersistedResizePreferencesOnReload() {
  const navigationEntry = performance.getEntriesByType("navigation")[0] as
    | PerformanceNavigationTiming
    | undefined;
  if (navigationEntry?.type !== "reload") return;

  try {
    const storageKeys = Array.from(
      { length: localStorage.length },
      (_, index) => localStorage.key(index)
    ).filter((key): key is string => key != null);

    for (const storageKey of storageKeys) {
      const isStandaloneResizePreference =
        storageKey.startsWith("arize-phoenix-drawer-") ||
        storageKey.startsWith("react-resizable-panels:") ||
        storageKey.includes("column-sizing-") ||
        storageKey === "arize-phoenix-trace-tree-width";

      if (isStandaloneResizePreference) {
        localStorage.removeItem(storageKey);
        continue;
      }

      const storedValue = localStorage.getItem(storageKey);
      if (storedValue == null) continue;

      try {
        const persistedStore = JSON.parse(storedValue) as {
          state?: { columnSizing?: unknown };
        };
        if (persistedStore.state?.columnSizing === undefined) continue;

        delete persistedStore.state.columnSizing;
        localStorage.setItem(storageKey, JSON.stringify(persistedStore));
      } catch {
        // This entry is not a persisted Zustand store; leave it untouched.
      }
    }
  } catch {
    // Storage may be unavailable under restrictive browser privacy settings.
  }
}

resetPersistedResizePreferencesOnReload();

const rootEl = document.getElementById("root");

const root = ReactDom.createRoot(rootEl!);

root.render(<App />);
