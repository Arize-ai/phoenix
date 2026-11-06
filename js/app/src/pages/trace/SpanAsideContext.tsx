import type { PropsWithChildren } from "react";
import { createContext, useContext, useState } from "react";

import { usePreferencesContext } from "@phoenix/contexts";

/** Split from the request context so a new request re-renders no control. */
const OpenSpanAsideContext = createContext<(() => void) | null>(null);

// Increments per request, so asking twice reopens the section rather than
// reading as no change.
const SpanAsideOpenRequestContext = createContext<number | null>(null);

/**
 * Connects the controls that open the span aside to the aside itself.
 * Opening takes two writes: the `isAnnotatingSpans` preference makes the
 * aside visible, and the aside expands the annotations section — which the
 * reader may have collapsed — since it owns the section panel.
 */
export function SpanAsideProvider({ children }: PropsWithChildren) {
  const setIsAnnotatingSpans = usePreferencesContext(
    (state) => state.setIsAnnotatingSpans
  );
  const [openRequest, setOpenRequest] = useState<number | null>(null);
  const open = () => {
    setIsAnnotatingSpans(true);
    setOpenRequest((prev) => (prev ?? 0) + 1);
  };
  return (
    <OpenSpanAsideContext.Provider value={open}>
      <SpanAsideOpenRequestContext.Provider value={openRequest}>
        {children}
      </SpanAsideOpenRequestContext.Provider>
    </OpenSpanAsideContext.Provider>
  );
}

/** Opens the span aside on its annotations editor. */
export function useOpenSpanAside() {
  const open = useContext(OpenSpanAsideContext);
  if (open == null) {
    throw new Error("useOpenSpanAside must be used within a SpanAsideProvider");
  }
  return open;
}

export function useSpanAsideOpenRequest() {
  return useContext(SpanAsideOpenRequestContext);
}
