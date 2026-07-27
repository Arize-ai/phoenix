import type { PropsWithChildren } from "react";
import { createContext, useCallback, useContext, useState } from "react";

import { usePreferencesContext } from "@phoenix/contexts";

/** The two things the span aside is for, each its own section of it. */
export type SpanAnnotationEditorSection = "annotations" | "notes";

/**
 * A section someone asked for. The nonce distinguishes one ask from the next,
 * so asking twice for a section the reader collapsed in between opens it again.
 */
export type SpanAnnotationEditorOpenRequest = {
  section: SpanAnnotationEditorSection;
  nonce: number;
};

const OpenSpanAnnotationEditorContext = createContext<
  ((section: SpanAnnotationEditorSection) => void) | null
>(null);

const SpanAnnotationEditorOpenRequestContext =
  createContext<SpanAnnotationEditorOpenRequest | null>(null);

/**
 * Lets anything on the span details view open the annotation aside on a given
 * section — the controls that do this are spread across the header and the
 * cards in the info tab, while the sections themselves live in the aside.
 *
 * Opening is two things at once: the aside is a preference, and each of its
 * sections is a collapsible panel the reader can have closed. A control that
 * set only the preference would slide open an aside with nothing in it.
 */
export function SpanAnnotationEditorProvider({ children }: PropsWithChildren) {
  const setIsAnnotatingSpans = usePreferencesContext(
    (state) => state.setIsAnnotatingSpans
  );
  const [openRequest, setOpenRequest] =
    useState<SpanAnnotationEditorOpenRequest | null>(null);
  const open = useCallback(
    (section: SpanAnnotationEditorSection) => {
      setIsAnnotatingSpans(true);
      setOpenRequest((prev) => ({ section, nonce: (prev?.nonce ?? 0) + 1 }));
    },
    [setIsAnnotatingSpans]
  );
  // two contexts rather than one object: the controls only ever call `open`,
  // which never changes, so a request does not re-render every one of them
  return (
    <OpenSpanAnnotationEditorContext.Provider value={open}>
      <SpanAnnotationEditorOpenRequestContext.Provider value={openRequest}>
        {children}
      </SpanAnnotationEditorOpenRequestContext.Provider>
    </OpenSpanAnnotationEditorContext.Provider>
  );
}

/**
 * Opens the annotation aside on one of its sections. For the controls that ask
 * for it; the aside itself reads {@link useSpanAnnotationEditorOpenRequest}.
 */
export function useOpenSpanAnnotationEditor() {
  const open = useContext(OpenSpanAnnotationEditorContext);
  if (open == null) {
    throw new Error(
      "useOpenSpanAnnotationEditor must be used within a SpanAnnotationEditorProvider"
    );
  }
  return open;
}

/** The section last asked for, for the aside to expand. */
export function useSpanAnnotationEditorOpenRequest() {
  return useContext(SpanAnnotationEditorOpenRequestContext);
}
