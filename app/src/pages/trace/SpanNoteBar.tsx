import { css } from "@emotion/react";
import { useLayoutEffect, useRef, useState } from "react";
import { TextArea } from "react-aria-components";
import { graphql, useMutation } from "react-relay";

import { Alert, Button, TextField } from "@phoenix/components";
import { usePreferencesContext } from "@phoenix/contexts";

import type { SpanNoteBarAddNoteMutation } from "./__generated__/SpanNoteBarAddNoteMutation.graphql";
import { useSpanNoteBarOpenRequest } from "./SpanNoteBarContext";

const MAX_INPUT_LINES = 6;

const spanNoteBarCSS = css`
  flex: none;

  .span-note-bar__row {
    display: flex;
    flex-direction: row;
    align-items: flex-end;
    gap: var(--global-dimension-size-150);
    padding: var(--global-dimension-size-200);
    border-top: var(--global-border-size-thin) solid
      var(--global-border-color-default);
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

type SpanNoteDrafts = Partial<Record<string, string>>;
type SpanNoteErrors = Partial<Record<string, string>>;

/** One note composer whose draft and error state remain bound to each span. */
export function SpanNoteBar({ spanNodeId }: { spanNodeId: string }) {
  const isTakingSpanNotes = usePreferencesContext(
    (state) => state.isTakingSpanNotes
  );
  const [drafts, setDrafts] = useState<SpanNoteDrafts>({});
  const [errors, setErrors] = useState<SpanNoteErrors>({});

  if (!isTakingSpanNotes) {
    return null;
  }

  return (
    <SpanNoteBarContent
      error={errors[spanNodeId] ?? null}
      noteText={drafts[spanNodeId] ?? ""}
      onErrorChange={(error) => {
        setErrors((currentErrors) => ({
          ...currentErrors,
          [spanNodeId]: error ?? undefined,
        }));
      }}
      onNoteTextChange={(noteText) => {
        setDrafts((currentDrafts) => ({
          ...currentDrafts,
          [spanNodeId]: noteText,
        }));
      }}
      onNoteSubmissionError={({ message, note }) => {
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
      }}
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
  spanNodeId,
}: {
  error: string | null;
  noteText: string;
  onErrorChange: (error: string | null) => void;
  onNoteTextChange: (noteText: string) => void;
  onNoteSubmissionError: (params: { message: string; note: string }) => void;
  spanNodeId: string;
}) {
  const setIsTakingSpanNotes = usePreferencesContext(
    (state) => state.setIsTakingSpanNotes
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const openRequest = useSpanNoteBarOpenRequest();

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
    });
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing || event.repeat) {
      return;
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submitNote();
    } else if (event.key === "Escape") {
      event.stopPropagation();
      if (noteText.trim() === "") {
        setIsTakingSpanNotes(false);
      } else {
        event.currentTarget.blur();
      }
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
        <Button
          size="M"
          variant="quiet"
          onPress={() => setIsTakingSpanNotes(false)}
        >
          Close
        </Button>
        <TextField
          className="span-note-bar__field"
          size="M"
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
          size="M"
          isDisabled={!noteText.trim() || isAddingNote}
          onPress={submitNote}
        >
          Add Note
        </Button>
      </div>
    </div>
  );
}
