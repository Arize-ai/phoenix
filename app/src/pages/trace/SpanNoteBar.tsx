import { css } from "@emotion/react";
import { useEffect, useLayoutEffect, useRef } from "react";
import { TextArea } from "react-aria-components";
import { graphql, useMutation } from "react-relay";

import { Alert, Button, Icon, Icons, TextField } from "@phoenix/components";
import { usePreferencesContext } from "@phoenix/contexts";

import type { SpanNoteBarAddNoteMutation } from "./__generated__/SpanNoteBarAddNoteMutation.graphql";
import {
  hasHigherOverlay,
  useSpanNoteBarOpenRequest,
  useSpanNoteDraft,
} from "./SpanNoteBarContext";

const MAX_INPUT_LINES = 6;

const spanNoteBarCSS = css`
  flex: none;

  .span-note-bar__row {
    display: flex;
    flex-direction: row;
    align-items: flex-end;
    gap: var(--global-dimension-size-150);
    box-sizing: border-box;
    min-height: var(--global-span-details-section-heading-height);
    padding: var(--global-dimension-size-100) var(--global-dimension-size-200);
    border-top: var(--global-border-size-thin) solid
      var(--global-border-color-default);
    background: var(--global-background-color-default);
  }

  .span-note-bar__field {
    flex: 1 1 auto;

    .react-aria-TextArea {
      max-height: calc(
        var(--textfield-input-height) + var(--global-line-height-s) *
          ${MAX_INPUT_LINES - 1}
      );
      overflow-y: auto;
      resize: none;
    }
  }
`;

/** One note composer whose draft and error state remain bound to each span. */
export function SpanNoteBar({
  onNoteCreated,
  spanNodeId,
}: {
  onNoteCreated?: (noteId: string) => void;
  spanNodeId: string;
}) {
  const isTakingSpanNotes = usePreferencesContext(
    (state) => state.isTakingSpanNotes
  );
  const { error, noteText, restoreAfterError, setError, setNoteText } =
    useSpanNoteDraft(spanNodeId);

  if (!isTakingSpanNotes) {
    return null;
  }

  return (
    <SpanNoteBarContent
      error={error}
      noteText={noteText}
      onErrorChange={setError}
      onNoteTextChange={setNoteText}
      onNoteSubmissionError={restoreAfterError}
      onNoteCreated={onNoteCreated}
      spanNodeId={spanNodeId}
    />
  );
}

function SpanNoteBarContent({
  error,
  noteText,
  onErrorChange,
  onNoteTextChange,
  onNoteSubmissionError,
  onNoteCreated,
  spanNodeId,
}: {
  error: string | null;
  noteText: string;
  onErrorChange: (error: string | null) => void;
  onNoteTextChange: (noteText: string) => void;
  onNoteSubmissionError: (params: { message: string; note: string }) => void;
  onNoteCreated?: (noteId: string) => void;
  spanNodeId: string;
}) {
  const setIsTakingSpanNotes = usePreferencesContext(
    (state) => state.setIsTakingSpanNotes
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const openRequest = useSpanNoteBarOpenRequest();

  useEffect(() => {
    const dismissNoteBar = (event: KeyboardEvent) => {
      if (
        event.key !== "Escape" ||
        event.defaultPrevented ||
        event.isComposing ||
        event.repeat ||
        hasHigherOverlay()
      ) {
        return;
      }
      // The open note bar is the first Escape layer even when its textarea no
      // longer has focus. Capture above the Drawer's document hotkey so this
      // keypress restores normal span details and a later Escape closes the
      // drawer.
      event.preventDefault();
      event.stopPropagation();
      setIsTakingSpanNotes(false);
    };
    window.addEventListener("keydown", dismissNoteBar, true);
    return () => window.removeEventListener("keydown", dismissNoteBar, true);
  }, [setIsTakingSpanNotes]);

  useLayoutEffect(() => {
    if (openRequest == null) {
      return;
    }
    textareaRef.current?.focus({ preventScroll: true });
  }, [openRequest]);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }
    textarea.style.height = "auto";
    const borderHeight = textarea.offsetHeight - textarea.clientHeight;
    textarea.style.height = `${textarea.scrollHeight + borderHeight}px`;
  }, [noteText]);

  const [addNote, isAddingNote] = useMutation<SpanNoteBarAddNoteMutation>(
    graphql`
      mutation SpanNoteBarAddNoteMutation(
        $input: CreateSpanNoteInput!
        $spanNodeId: ID!
      ) {
        createSpanNote(annotationInput: $input) {
          spanAnnotations {
            id
          }
          query {
            node(id: $spanNodeId) {
              ... on Span {
                id
                spanNotes {
                  id
                  explanation
                  createdAt
                  user {
                    id
                    username
                  }
                }
              }
            }
          }
        }
      }
    `
  );

  const submitNote = () => {
    const note = noteText.trim();
    if (!note || isAddingNote) {
      return;
    }
    onErrorChange(null);
    onNoteTextChange("");
    addNote({
      variables: {
        input: {
          note,
          spanId: spanNodeId,
        },
        spanNodeId,
      },
      onError: (mutationError) => {
        onNoteSubmissionError({ message: mutationError.message, note });
      },
      onCompleted: (response) => {
        setIsTakingSpanNotes(false);
        const createdNoteId = response.createSpanNote.spanAnnotations[0]?.id;
        if (createdNoteId != null) {
          onNoteCreated?.(createdNoteId);
        }
      },
    });
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing || event.repeat) {
      return;
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submitNote();
    }
  };

  return (
    <div className="span-note-bar" css={spanNoteBarCSS}>
      {error ? (
        <Alert variant="danger" title="Failed to add note" banner>
          {error}
        </Alert>
      ) : null}
      <div className="span-note-bar__row">
        <TextField
          className="span-note-bar__field"
          size="S"
          value={noteText}
          onChange={(nextNoteText) => {
            onErrorChange(null);
            onNoteTextChange(nextNoteText);
          }}
          aria-label="Add a note to this span"
        >
          <TextArea
            ref={textareaRef}
            rows={1}
            placeholder="Add a note to this span…"
            onKeyDown={onKeyDown}
          />
        </TextField>
        <Button
          variant="primary"
          size="S"
          aria-label="Add note"
          isDisabled={!noteText.trim() || isAddingNote}
          leadingVisual={<Icon svg={<Icons.ArrowUp />} />}
          onPress={submitNote}
        />
        <Button
          size="S"
          variant="quiet"
          aria-label="Close notes"
          leadingVisual={<Icon svg={<Icons.Close />} />}
          onPress={() => setIsTakingSpanNotes(false)}
        />
      </div>
    </div>
  );
}
