import type { PropsWithChildren } from "react";
import { createContext, useContext, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";

import { NOTE_HOTKEY } from "@phoenix/constants";
import { usePreferencesContext } from "@phoenix/contexts";
import { getActiveModalOverlayElement } from "@phoenix/hooks/useHasOpenModal";

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
function hasHigherOverlay() {
  return (
    getActiveModalOverlayElement() != null ||
    document.querySelector(".react-aria-Popover") != null
  );
}

function shouldRouteNoteHotkey(event: KeyboardEvent) {
  return !event.repeat && !event.isComposing && !hasHigherOverlay();
}

export function SpanNoteBarProvider({
  children,
  isHotkeyEnabled,
}: PropsWithChildren<{ isHotkeyEnabled: boolean }>) {
  const setIsTakingSpanNotes = usePreferencesContext(
    (state) => state.setIsTakingSpanNotes
  );
  const [openRequest, setOpenRequest] = useState<number | null>(null);
  const open = () => {
    setIsTakingSpanNotes(true);
    setOpenRequest((prev) => (prev ?? 0) + 1);
  };
  useHotkeys(
    NOTE_HOTKEY,
    (event) => {
      if (!shouldRouteNoteHotkey(event)) {
        return;
      }
      open();
    },
    {
      enabled: isHotkeyEnabled,
      preventDefault: (event) =>
        isHotkeyEnabled && shouldRouteNoteHotkey(event),
    }
  );
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

export function useOptionalOpenSpanNoteBar() {
  return useContext(OpenSpanNoteBarContext);
}

export function useSpanNoteBarOpenRequest() {
  return useContext(SpanNoteBarOpenRequestContext);
}
