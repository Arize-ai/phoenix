import type { PropsWithChildren } from "react";
import { createContext, useContext, useState } from "react";

import { usePreferencesContext } from "@phoenix/contexts";

/**
 * `requestId` increments per request, so asking to open the bar while it is
 * already up reads as a new request and re-focuses the input.
 */
export type SpanNoteBarOpenRequest = {
  requestId: number;
};

/** Split from the request context so a new request re-renders no control. */
const OpenSpanNoteBarContext = createContext<(() => void) | null>(null);

const SpanNoteBarOpenRequestContext =
  createContext<SpanNoteBarOpenRequest | null>(null);

/**
 * Connects the controls that open the span note bar to the bar itself.
 *
 * Opening takes two writes: the `isTakingSpanNotes` preference mounts the bar
 * (and persists, so a bar left up survives span changes and reloads), and the
 * request tells the bar to focus its input. The request is what separates
 * "the reader left the bar up" from "the reader asked for it just now" — only
 * the latter should steal focus.
 *
 * Belongs above the span details view — the controls sit in the header hotkeys
 * and the info tab, and the bar is a sibling of both.
 */
export function SpanNoteBarProvider({ children }: PropsWithChildren) {
  const setIsTakingSpanNotes = usePreferencesContext(
    (state) => state.setIsTakingSpanNotes
  );
  const [openRequest, setOpenRequest] = useState<SpanNoteBarOpenRequest | null>(
    null
  );
  const open = () => {
    setIsTakingSpanNotes(true);
    setOpenRequest((prev) => ({
      requestId: (prev?.requestId ?? 0) + 1,
    }));
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

/** The latest request to focus the bar. Null until a control makes one. */
export function useSpanNoteBarOpenRequest() {
  return useContext(SpanNoteBarOpenRequestContext);
}
