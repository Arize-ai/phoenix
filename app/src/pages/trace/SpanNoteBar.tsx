import { css } from "@emotion/react";
import {
  startTransition,
  Suspense,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { TextArea } from "react-aria-components";
import { graphql, useLazyLoadQuery, useMutation } from "react-relay";

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
import type { SpanNoteBarNotesQuery } from "./__generated__/SpanNoteBarNotesQuery.graphql";
import { useSpanNoteBarOpenRequest } from "./SpanNoteBarContext";

// The input grows with its content up to this many lines, then scrolls.
const MAX_INPUT_LINES = 6;

const spanNoteBarCSS = css`
  flex: none;
  // Clips the bar while it rises in from under the bottom edge.
  overflow: hidden;

  // The border lives on the row, not the clip, so the whole visible bar —
  // border and controls together — moves as one unit.
  .span-note-bar__row {
    display: flex;
    flex-direction: row;
    align-items: flex-end;
    gap: var(--global-dimension-size-150);
    padding: var(--global-dimension-size-200);
    border-top: 1px solid var(--global-border-color-default);

    // The slot claims its space at once; the fully-composed bar then rises
    // uniformly into it, so no control is ever shown partially revealed.
    @media (prefers-reduced-motion: no-preference) {
      animation: span-note-bar-rise 0.2s ease-out;
    }
  }

  @keyframes span-note-bar-rise {
    from {
      transform: translateY(100%);
    }
  }

  .span-note-bar__field {
    flex: 1 1 auto;

    .react-aria-TextArea {
      resize: none;
      overflow-y: auto;
      line-height: var(--global-line-height-s);
      max-height: calc(
        var(--global-line-height-s) * ${MAX_INPUT_LINES} + 2 *
          var(--textfield-vertical-padding) + 2px
      );
    }
  }
`;

/**
 * A note-taking bar pinned to the bottom of the span details. Mounted only
 * while the `isTakingSpanNotes` preference is on, so a bar left up stays up —
 * across spans and across sessions — until the reader dismisses it.
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
  const [fetchKey, setFetchKey] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus is by request only: the hotkey and the card button ask for it, a
  // remembered-open bar mounting on page load does not.
  const openRequest = useSpanNoteBarOpenRequest();
  useLayoutEffect(() => {
    if (openRequest == null) {
      return;
    }
    textareaRef.current?.focus();
  }, [openRequest]);

  // Grow the input with its content; the CSS max-height caps the growth.
  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [noteText]);

  const [addNote, isAddingNote] = useMutation<SpanNoteBarAddNoteMutation>(
    graphql`
      mutation SpanNoteBarAddNoteMutation($input: CreateSpanNoteInput!) {
        createSpanNote(annotationInput: $input) {
          __typename
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
      },
      onCompleted: () => {
        // refetching the annotations writes them back to the store, so every
        // mounted view of this span's notes updates along with the count
        startTransition(() => {
          setFetchKey((key) => key + 1);
        });
      },
      onError: (error) => {
        // hand the draft back rather than losing it, unless they typed more
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
          Add
        </Button>
      </div>
      <Suspense fallback={null}>
        <SpanNotesStoreSync spanNodeId={spanNodeId} fetchKey={fetchKey} />
      </Suspense>
    </div>
  );
}

/**
 * Renders nothing. Selects the same fields as the notes table so bumping the
 * fetch key after adding a note writes fresh annotations back to the store,
 * refreshing every mounted view of the span's notes.
 */
function SpanNotesStoreSync({
  spanNodeId,
  fetchKey,
}: {
  spanNodeId: string;
  fetchKey: number;
}) {
  useLazyLoadQuery<SpanNoteBarNotesQuery>(
    graphql`
      query SpanNoteBarNotesQuery($spanNodeId: ID!) {
        span: node(id: $spanNodeId) {
          ... on Span {
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
    `,
    { spanNodeId },
    { fetchKey, fetchPolicy: "store-and-network" }
  );
  return null;
}
