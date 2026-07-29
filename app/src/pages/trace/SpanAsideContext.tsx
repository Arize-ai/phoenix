import type { PropsWithChildren } from "react";
import { createContext, useContext, useState } from "react";

import { usePreferencesContext } from "@phoenix/contexts";

/**
 * `requestId` increments per request, so asking twice reopens the section
 * rather than reading as no change.
 */
export type SpanAsideOpenRequest = {
  requestId: number;
};

/** Split from the request context so a new request re-renders no control. */
const OpenSpanAsideContext = createContext<(() => void) | null>(null);

const SpanAsideOpenRequestContext = createContext<SpanAsideOpenRequest | null>(
  null
);

/**
 * Connects the controls that open the span aside to the aside itself.
 *
 * Opening takes two writes: the `isAnnotatingSpans` preference makes the aside
 * visible, and the aside expands the annotations section, since it owns the
 * section panel. The preference alone reveals an aside whose section the
 * reader may have collapsed.
 *
 * Belongs above the span details view — the controls sit in the header and the
 * info tab, and the aside is a sibling of both.
 */
export function SpanAsideProvider({ children }: PropsWithChildren) {
  const setIsAnnotatingSpans = usePreferencesContext(
    (state) => state.setIsAnnotatingSpans
  );
  const [openRequest, setOpenRequest] = useState<SpanAsideOpenRequest | null>(
    null
  );
  const open = () => {
    setIsAnnotatingSpans(true);
    setOpenRequest((prev) => ({
      requestId: (prev?.requestId ?? 0) + 1,
    }));
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

/** The latest request to expand the aside. Null until a control makes one. */
export function useSpanAsideOpenRequest() {
  return useContext(SpanAsideOpenRequestContext);
}
