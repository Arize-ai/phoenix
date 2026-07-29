import type { PropsWithChildren, RefObject } from "react";
import { createContext, useContext, useEffect, useState } from "react";

const DetailsPanelInteractionScopeContext = createContext(false);

function isEventInsideDetailsPanel({
  event,
  root,
}: {
  event: Event;
  root: HTMLElement | null;
}) {
  return root != null && event.composedPath().includes(root);
}

/**
 * Tracks whether the details panel was the most recently interacted-with
 * region without making its non-interactive content artificially focusable.
 */
export function DetailsPanelInteractionScope({
  children,
  rootRef,
}: PropsWithChildren<{
  rootRef: RefObject<HTMLElement | null>;
}>) {
  const [isInteractionActive, setIsInteractionActive] = useState(false);

  useEffect(() => {
    const updateInteractionScope = (event: Event) => {
      setIsInteractionActive(
        isEventInsideDetailsPanel({ event, root: rootRef.current })
      );
    };
    window.addEventListener("pointerdown", updateInteractionScope, true);
    window.addEventListener("focusin", updateInteractionScope, true);
    return () => {
      window.removeEventListener("pointerdown", updateInteractionScope, true);
      window.removeEventListener("focusin", updateInteractionScope, true);
    };
  }, [rootRef]);

  return (
    <DetailsPanelInteractionScopeContext.Provider value={isInteractionActive}>
      {children}
    </DetailsPanelInteractionScopeContext.Provider>
  );
}

export function useIsDetailsPanelInteractionActive() {
  return useContext(DetailsPanelInteractionScopeContext);
}
