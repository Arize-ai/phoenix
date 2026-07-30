import type { Dispatch, PropsWithChildren, SetStateAction } from "react";
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
const ActiveSpanNoteBarContext = createContext<string | null>(null);

type SpanNoteDrafts = Partial<Record<string, string>>;
type SpanNoteErrors = Partial<Record<string, string>>;

const SpanNoteDraftsContext = createContext<{
  drafts: SpanNoteDrafts;
  errors: SpanNoteErrors;
  setDrafts: Dispatch<SetStateAction<SpanNoteDrafts>>;
  setErrors: Dispatch<SetStateAction<SpanNoteErrors>>;
} | null>(null);

/**
 * Connects the controls that open the span note bar to the bar itself.
 * Opening takes two writes: the `isTakingSpanNotes` preference mounts the bar,
 * and the request tells it to focus its input — only an explicit request
 * should steal focus, not a remembered-open bar mounting on page load.
 */
export function hasHigherOverlay() {
  return (
    getActiveModalOverlayElement() != null ||
    document.querySelector(".react-aria-Popover") != null
  );
}

function shouldRouteNoteHotkey(event: KeyboardEvent) {
  return !event.repeat && !event.isComposing && !hasHigherOverlay();
}

export function SpanNoteBarProvider({
  activeSpanNodeId = null,
  children,
  isHotkeyEnabled,
}: PropsWithChildren<{
  activeSpanNodeId?: string | null;
  isHotkeyEnabled: boolean;
}>) {
  const setIsTakingSpanNotes = usePreferencesContext(
    (state) => state.setIsTakingSpanNotes
  );
  const [openRequest, setOpenRequest] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<SpanNoteDrafts>({});
  const [errors, setErrors] = useState<SpanNoteErrors>({});
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
        <ActiveSpanNoteBarContext.Provider value={activeSpanNodeId}>
          <SpanNoteDraftsContext.Provider
            value={{ drafts, errors, setDrafts, setErrors }}
          >
            {children}
          </SpanNoteDraftsContext.Provider>
        </ActiveSpanNoteBarContext.Provider>
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

export function useIsActiveSpanNoteBar(spanNodeId: string) {
  const activeSpanNodeId = useContext(ActiveSpanNoteBarContext);
  return activeSpanNodeId == null || activeSpanNodeId === spanNodeId;
}

export function useSpanNoteDraft(spanNodeId: string) {
  const context = useContext(SpanNoteDraftsContext);
  if (context == null) {
    throw new Error(
      "useSpanNoteDraft must be used within a SpanNoteBarProvider"
    );
  }
  const { drafts, errors, setDrafts, setErrors } = context;
  return {
    error: errors[spanNodeId] ?? null,
    noteText: drafts[spanNodeId] ?? "",
    setError: (error: string | null) => {
      setErrors((currentErrors) => ({
        ...currentErrors,
        [spanNodeId]: error ?? undefined,
      }));
    },
    setNoteText: (noteText: string) => {
      setDrafts((currentDrafts) => ({
        ...currentDrafts,
        [spanNodeId]: noteText,
      }));
    },
    restoreAfterError: ({
      message,
      note,
    }: {
      message: string;
      note: string;
    }) => {
      setDrafts((currentDrafts) => ({
        ...currentDrafts,
        [spanNodeId]: currentDrafts[spanNodeId]
          ? currentDrafts[spanNodeId]
          : note,
      }));
      setErrors((currentErrors) => ({
        ...currentErrors,
        [spanNodeId]: message,
      }));
    },
  };
}
