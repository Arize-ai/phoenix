import type { ReactNode } from "react";
import { createContext, useContext, useState } from "react";

type AppFrameOverlayContextValue = {
  applicationViewportElement: HTMLDivElement | null;
  drawerHostElement: HTMLDivElement | null;
  isViewportBlocked: boolean;
  registerViewportOverlay: () => void;
  setApplicationViewportElement: (element: HTMLDivElement | null) => void;
  setDrawerHostElement: (element: HTMLDivElement | null) => void;
  setViewportModalHostElement: (element: HTMLDivElement | null) => void;
  unregisterViewportOverlay: () => void;
  viewportModalHostElement: HTMLDivElement | null;
};

const AppFrameOverlayContext =
  createContext<AppFrameOverlayContextValue | null>(null);

/**
 * Owns the DOM hosts and blocking state for overlays that belong to the
 * application viewport rather than the browser window.
 */
export function AppFrameOverlayProvider({ children }: { children: ReactNode }) {
  const [applicationViewportElement, setApplicationViewportElement] =
    useState<HTMLDivElement | null>(null);
  const [drawerHostElement, setDrawerHostElement] =
    useState<HTMLDivElement | null>(null);
  const [viewportModalHostElement, setViewportModalHostElement] =
    useState<HTMLDivElement | null>(null);
  const [viewportOverlayCount, setViewportOverlayCount] = useState(0);
  const [registerViewportOverlay] = useState(
    () => () => setViewportOverlayCount((count) => count + 1)
  );
  const [unregisterViewportOverlay] = useState(
    () => () => setViewportOverlayCount((count) => Math.max(0, count - 1))
  );

  return (
    <AppFrameOverlayContext.Provider
      value={{
        applicationViewportElement,
        drawerHostElement,
        isViewportBlocked: viewportOverlayCount > 0,
        registerViewportOverlay,
        setApplicationViewportElement,
        setDrawerHostElement,
        setViewportModalHostElement,
        unregisterViewportOverlay,
        viewportModalHostElement,
      }}
    >
      {children}
    </AppFrameOverlayContext.Provider>
  );
}

export function useAppFrameOverlay() {
  return useContext(AppFrameOverlayContext);
}
