import type { PropsWithChildren } from "react";
import { createContext, useCallback, useContext, useState } from "react";

import { usePreferencesContext } from "@phoenix/contexts";

/** A collapsible section of the span aside. */
export type SpanAsideSection = "annotations" | "notes";

/**
 * `requestId` increments per request, so asking twice for the same section
 * reopens it rather than reading as no change.
 */
export type SpanAsideOpenRequest = {
  section: SpanAsideSection;
  requestId: number;
};

/** Split from the request below so the controls never re-render on one. */
const OpenSpanAsideContext = createContext<
  ((section: SpanAsideSection) => void) | null
>(null);

const SpanAsideOpenRequestContext = createContext<SpanAsideOpenRequest | null>(
  null
);

/**
 * Connects the controls that open the span aside to the aside itself.
 *
 * Opening on a section takes two writes: the `isAnnotatingSpans` preference
 * makes the aside visible, and the aside expands the section, since it owns the
 * section panels. The preference alone reveals an aside whose sections the
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
  const open = useCallback(
    (section: SpanAsideSection) => {
      setIsAnnotatingSpans(true);
      setOpenRequest((prev) => ({
        section,
        requestId: (prev?.requestId ?? 0) + 1,
      }));
    },
    [setIsAnnotatingSpans]
  );
  return (
    <OpenSpanAsideContext.Provider value={open}>
      <SpanAsideOpenRequestContext.Provider value={openRequest}>
        {children}
      </SpanAsideOpenRequestContext.Provider>
    </OpenSpanAsideContext.Provider>
  );
}

/** Opens the span aside on one of its sections. For the controls. */
export function useOpenSpanAside() {
  const open = useContext(OpenSpanAsideContext);
  if (open == null) {
    throw new Error("useOpenSpanAside must be used within a SpanAsideProvider");
  }
  return open;
}

/** The section to expand, for the aside. Null until a control requests one. */
export function useSpanAsideOpenRequest() {
  return useContext(SpanAsideOpenRequestContext);
}
