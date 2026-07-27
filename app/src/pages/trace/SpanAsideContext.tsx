import type { PropsWithChildren } from "react";
import { createContext, useCallback, useContext, useState } from "react";

import { usePreferencesContext } from "@phoenix/contexts";

/**
 * A collapsible section of the span aside: the annotation composer or the note
 * composer.
 */
export type SpanAsideSection = "annotations" | "notes";

/**
 * A request to open a section of the span aside.
 *
 * `requestId` increments per request, so repeat requests for the same section
 * are distinct values and the aside reopens a section the reader collapsed.
 */
export type SpanAsideOpenRequest = {
  section: SpanAsideSection;
  requestId: number;
};

/** Stable across renders, so the controls that consume it never re-render. */
const OpenSpanAsideContext = createContext<
  ((section: SpanAsideSection) => void) | null
>(null);

/** Changes per request. The aside is its only consumer. */
const SpanAsideOpenRequestContext = createContext<SpanAsideOpenRequest | null>(
  null
);

/**
 * Connects the controls that open the span aside to the aside itself.
 *
 * Opening the aside on a section takes two writes in two components. The
 * `isAnnotatingSpans` preference makes the aside visible, and the aside expands
 * the section, since it owns the section panels. Setting the preference alone
 * reveals an aside whose sections the reader may have collapsed.
 *
 * A control — a hotkey in `SpanDetails`, a button on one of the info tab's
 * cards — calls {@link useOpenSpanAside}. The provider sets the preference and
 * records the request, and the aside expands the requested section.
 *
 * Belongs above the span details view: the controls sit in the header and the
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

/**
 * Opens the span aside on one of its sections. For the controls that request
 * it; the aside itself reads {@link useSpanAsideOpenRequest}.
 */
export function useOpenSpanAside() {
  const open = useContext(OpenSpanAsideContext);
  if (open == null) {
    throw new Error("useOpenSpanAside must be used within a SpanAsideProvider");
  }
  return open;
}

/**
 * The section the aside should expand. Null until a control requests one, and a
 * new value per request.
 */
export function useSpanAsideOpenRequest() {
  return useContext(SpanAsideOpenRequestContext);
}
