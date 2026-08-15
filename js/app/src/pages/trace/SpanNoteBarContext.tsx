import type { PropsWithChildren } from "react";
import { createContext, useContext, useState } from "react";

import { usePreferencesContext } from "@phoenix/contexts";

/** Split from the request context so a new request re-renders no control. */
const OpenSpanNoteBarContext = createContext<(() => void) | null>(null);

// Increments per request, so asking to open a bar that is already up reads as
// a new request and re-focuses the input.
const SpanNoteBarOpenRequestContext = createContext<number | null>(null);

/**
 * Connects the controls that open the span note bar to the bar itself.
 * Opening takes two writes: the `isTakingSpanNotes` preference mounts the bar,
 * and the request tells it to focus its input — only an explicit request
 * should steal focus, not a remembered-open bar mounting on page load.
 */
export function SpanNoteBarProvider({ children }: PropsWithChildren) {
  const setIsTakingSpanNotes = usePreferencesContext(
    (state) => state.setIsTakingSpanNotes
  );
  const [openRequest, setOpenRequest] = useState<number | null>(null);
  const open = () => {
    setIsTakingSpanNotes(true);
    setOpenRequest((prev) => (prev ?? 0) + 1);
  };
  return (
    <OpenSpanNoteBarContext.Provider value={open}>
      <SpanNoteBarOpenRequestContext.Provider value={openRequest}>
        {children}
      </SpanNoteBarOpenRequestContext.Provider>
    </OpenSpanNoteBarContext.Provider>
  );
}

/** Opens the span note bar and focuses its input. */
export function useOpenSpanNoteBar() {
  const open = useContext(OpenSpanNoteBarContext);
  if (open == null) {
    throw new Error(
      "useOpenSpanNoteBar must be used within a SpanNoteBarProvider"
    );
  }
  return open;
}

export function useSpanNoteBarOpenRequest() {
  return useContext(SpanNoteBarOpenRequestContext);
}
