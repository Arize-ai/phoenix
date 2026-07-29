import { css, keyframes } from "@emotion/react";
import { useLayoutEffect, useRef, useState } from "react";
import { TextArea } from "react-aria-components";
import { graphql, useMutation } from "react-relay";

import {
  Button,
  Icon,
  IconButton,
  Icons,
  TextField,
  Tooltip,
  TooltipTrigger,
} from "@phoenix/components";
import { useNotifyError, usePreferencesContext } from "@phoenix/contexts";

import type { SpanNoteBarAddNoteMutation } from "./__generated__/SpanNoteBarAddNoteMutation.graphql";
import { useSpanNoteBarOpenRequest } from "./SpanNoteBarContext";

const MAX_INPUT_LINES = 6;

const riseIn = keyframes`
  from {
    transform: translateY(100%);
  }
`;

const spanNoteBarCSS = css`
  flex: none;
  // clip, not hidden: a hidden box is still a scroll container, and the
  // focus-on-open would scroll it to reveal the still-translated row,
  // cancelling the rise
  overflow: clip;

  // The border lives on the row, not the clip, so the whole visible bar
  // rises as one unit.
  .span-note-bar__row {
    display: flex;
    flex-direction: row;
    align-items: flex-end;
    gap: var(--global-dimension-size-150);
    padding: var(--global-dimension-size-200);
    border-top: 1px solid var(--global-border-color-default);
    animation: ${riseIn} 0.3s ease-out;

    @media (prefers-reduced-motion: reduce) {
      animation: none;
    }
  }

  .span-note-bar__field {
    flex: 1 1 auto;

    .react-aria-TextArea {
      resize: none;
      overflow-y: auto;
      // a single-line textarea is exactly the input height, so growing caps
      // at the height of the extra lines
      max-height: calc(
        var(--textfield-input-height) + var(--global-line-height-s) *
          ${MAX_INPUT_LINES - 1}
      );
    }
  }
`;

/**
 * A note-taking bar pinned to the bottom of the span details. Mounted only
 * while the `isTakingSpanNotes` preference is on.
 */
export function SpanNoteBar({ spanNodeId }: { spanNodeId: string }) {
  const isTakingSpanNotes = usePreferencesContext(
    (state) => state.isTakingSpanNotes
  );
  if (!isTakingSpanNotes) {
    return null;
  }
  return <SpanNoteBarContent spanNodeId={spanNodeId} />;
}

function SpanNoteBarContent({ spanNodeId }: { spanNodeId: string }) {
  const setIsTakingSpanNotes = usePreferencesContext(
    (state) => state.setIsTakingSpanNotes
  );
  const notifyError = useNotifyError();
  const [noteText, setNoteText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus is by request only — a remembered-open bar mounting on page load
  // should not steal it. preventScroll: revealing the focused field must not
  // scroll an ancestor while the row is still translated down mid-rise.
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
    // scrollHeight excludes the borders that the border-box height includes,
    // so add them back or the field renders short of the button height
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
                # the slice every notes view reads, so the new note lands in
                # the store for all of them in the one round trip
                spanAnnotations {
                  id
                  name
                  explanation
                  createdAt
                  user {
                    id
                    username
                    profilePictureUrl
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
    setNoteText("");
    addNote({
      variables: {
        input: {
          note,
          spanId: spanNodeId,
        },
        spanNodeId,
      },
      onError: (error) => {
        // restore the draft unless they typed more
        setNoteText((current) => (current === "" ? note : current));
        notifyError({
          title: "Failed to add note",
          message: error.message,
        });
      },
    });
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submitNote();
    } else if (event.key === "Escape") {
      // this Escape is for the bar, not the surrounding drawer
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
      <div className="span-note-bar__row">
        <TooltipTrigger>
          <IconButton
            size="M"
            aria-label="Close notes"
            onPress={() => setIsTakingSpanNotes(false)}
          >
            <Icon svg={<Icons.Close />} />
          </IconButton>
          <Tooltip offset={1}>Close notes</Tooltip>
        </TooltipTrigger>
        <TextField
          className="span-note-bar__field"
          size="M"
          value={noteText}
          onChange={setNoteText}
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
