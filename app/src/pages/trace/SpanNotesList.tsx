import { css, keyframes } from "@emotion/react";
import { useLayoutEffect, useRef, useState } from "react";
import { graphql, useLazyLoadQuery, useMutation } from "react-relay";

import {
  Alert,
  Button,
  Flex,
  Text,
  TextArea,
  TextField,
  View,
} from "@phoenix/components";
import { PxiAnimatedGlyph } from "@phoenix/components/agent";
import { promptInputSurfaceCSS } from "@phoenix/components/ai/prompt-input";
import { EmptyState, EmptyStateGraphic } from "@phoenix/components/core/empty";
import { UserPicture } from "@phoenix/components/user/UserPicture";
import { useTimeFormatters } from "@phoenix/hooks";

import type { SpanNotesListDeleteNoteMutation } from "./__generated__/SpanNotesListDeleteNoteMutation.graphql";
import type { SpanNotesListQuery } from "./__generated__/SpanNotesListQuery.graphql";
import type { SpanNotesListUpdateNoteMutation } from "./__generated__/SpanNotesListUpdateNoteMutation.graphql";

type SpanNotesListProps = {
  newNoteId?: string | null;
  spanId: string;
};

type SpanNoteMutationResult =
  | { success: true }
  | { error: string; success: false };

type UpdateSpanNoteParams = {
  noteId: string;
  noteText: string;
};

/** Fetches the reserved note annotations when the notes section is mounted. */
export function SpanNotesList({ newNoteId, spanId }: SpanNotesListProps) {
  const data = useLazyLoadQuery<SpanNotesListQuery>(
    graphql`
      query SpanNotesListQuery($id: ID!) {
        span: node(id: $id) {
          ... on Span {
            spanNotes {
              id
              explanation
              identifier
              source
              annotatorKind
              metadata
              createdAt
              updatedAt
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
    { id: spanId }
  );
  const [updateNote] = useMutation<SpanNotesListUpdateNoteMutation>(graphql`
    mutation SpanNotesListUpdateNoteMutation(
      $input: PatchAnnotationInput!
      $spanId: ID!
    ) {
      patchSpanAnnotations(input: [$input]) {
        query {
          node(id: $spanId) {
            ... on Span {
              id
              spanNotes {
                id
                explanation
                identifier
                source
                annotatorKind
                metadata
                createdAt
                updatedAt
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
  `);
  const [deleteNote] = useMutation<SpanNotesListDeleteNoteMutation>(graphql`
    mutation SpanNotesListDeleteNoteMutation($annotationId: ID!, $spanId: ID!) {
      deleteSpanAnnotations(input: { annotationIds: [$annotationId] }) {
        query {
          node(id: $spanId) {
            ... on Span {
              id
              spanNotes {
                id
                explanation
                identifier
                source
                annotatorKind
                metadata
                createdAt
                updatedAt
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
  `);

  const handleUpdateNote = ({
    noteId,
    noteText,
  }: UpdateSpanNoteParams): Promise<SpanNoteMutationResult> =>
    new Promise((resolve) => {
      updateNote({
        variables: {
          input: { annotationId: noteId, explanation: noteText },
          spanId,
        },
        onCompleted: () => resolve({ success: true }),
        onError: (error) => resolve({ error: error.message, success: false }),
      });
    });

  const handleDeleteNote = (noteId: string): Promise<SpanNoteMutationResult> =>
    new Promise((resolve) => {
      deleteNote({
        variables: { annotationId: noteId, spanId },
        onCompleted: () => resolve({ success: true }),
        onError: (error) => resolve({ error: error.message, success: false }),
      });
    });

  return (
    <SpanNotesListContent
      newNoteId={newNoteId}
      notes={data.span?.spanNotes ?? []}
      onDeleteNote={handleDeleteNote}
      onUpdateNote={handleUpdateNote}
    />
  );
}

export type SpanNote = {
  annotatorKind: string;
  id: string;
  explanation: string | null;
  identifier: string;
  metadata: unknown;
  source: string;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    profilePictureUrl?: string | null;
    username: string;
  } | null;
};

function getSpanNoteMetadataTitle({
  note,
  username,
}: {
  note: SpanNote;
  username: string;
}) {
  const userId = note.user?.id ?? "none";
  const serializedMetadata = JSON.stringify(note.metadata, null, 2);
  return [
    `Author: ${username}`,
    `User ID: ${userId}`,
    `Annotation ID: ${note.id}`,
    `Identifier: ${note.identifier}`,
    `Source: ${note.source}`,
    `Annotator kind: ${note.annotatorKind}`,
    `Created: ${note.createdAt}`,
    `Updated: ${note.updatedAt}`,
    `Metadata: ${serializedMetadata}`,
  ].join("\n");
}

const noteFadeInKeyframes = keyframes`
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
`;

const notesListCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-100);
  margin: var(--global-grid-margin-xsmall);
  padding: 0;
  list-style: none;

  & > li[data-new-note="true"] {
    animation: ${noteFadeInKeyframes} 200ms ease-out both;

    @media (prefers-reduced-motion: reduce) {
      animation: none;
    }
  }
`;

const noteCSS = css`
  .span-note__text-surface {
    ${promptInputSurfaceCSS}

    padding: var(--global-dimension-size-200);
  }

  .span-note__text {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .span-note__text[data-confirming-delete="true"] {
    opacity: 0.2;
  }

  .span-note__footer,
  .span-note__author,
  .span-note__attribution {
    display: flex;
    flex-direction: row;
    align-items: center;
  }

  .span-note__footer {
    justify-content: space-between;
    gap: var(--global-dimension-size-100);
    min-width: 0;
    scroll-margin-block-end: var(--global-dimension-size-200);
  }

  [data-span-note-frame][data-framed="true"] {
    scroll-margin-block-end: var(--global-dimension-size-200);
  }

  .span-note__author {
    gap: var(--global-dimension-size-100);
    min-width: 0;
  }

  .span-note__attribution {
    flex: none;
    gap: var(--global-dimension-size-50);
  }

  .span-note__author > * {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .span-note__editor,
  .span-note__editor > .text-field,
  .span-note__editor .react-aria-TextArea {
    width: 100%;
  }

  .span-note__editor .react-aria-TextArea {
    display: block;
    resize: none;
  }
`;

const emptyStateCSS = css`
  padding: var(--global-dimension-size-400) var(--global-dimension-size-100);
`;

export function SpanNotesListContent({
  newNoteId,
  notes,
  onDeleteNote,
  onUpdateNote,
}: {
  newNoteId?: string | null;
  notes: readonly SpanNote[];
  onDeleteNote: (noteId: string) => Promise<SpanNoteMutationResult>;
  onUpdateNote: (
    params: UpdateSpanNoteParams
  ) => Promise<SpanNoteMutationResult>;
}) {
  if (notes.length === 0) {
    return (
      <Flex direction="column" alignItems="center" css={emptyStateCSS}>
        <EmptyState
          graphic={<EmptyStateGraphic variant="note" />}
          description="No notes for this span"
        />
      </Flex>
    );
  }

  return (
    <ul css={notesListCSS}>
      {notes.map((note) => {
        const isNewNote = note.id === newNoteId;
        return (
          <SpanNoteListItem
            key={note.id}
            isNewNote={isNewNote}
            note={note}
            onDeleteNote={onDeleteNote}
            onUpdateNote={onUpdateNote}
          />
        );
      })}
    </ul>
  );
}

function SpanNoteListItem({
  isNewNote,
  note,
  onDeleteNote,
  onUpdateNote,
}: {
  isNewNote: boolean;
  note: SpanNote;
  onDeleteNote: (noteId: string) => Promise<SpanNoteMutationResult>;
  onUpdateNote: (
    params: UpdateSpanNoteParams
  ) => Promise<SpanNoteMutationResult>;
}) {
  const noteFrameRef = useRef<HTMLElement>(null);
  const noteFooterRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [noteText, setNoteText] = useState(note.explanation ?? "");
  const { friendlyDateTimeFormatter } = useTimeFormatters();
  const username = note.user?.username ?? "system";
  const originalNoteText = note.explanation ?? "";
  const trimmedNoteText = noteText.trim();
  const isDirty = trimmedNoteText !== originalNoteText.trim();
  const canSave = isDirty && trimmedNoteText.length > 0 && !isSaving;
  const isFramed = isEditing || isConfirmingDelete;
  const createdAt = new Date(note.createdAt);
  const updatedAt = new Date(note.updatedAt);
  const isEdited = updatedAt.getTime() > createdAt.getTime();
  const displayedDate = isEdited ? updatedAt : createdAt;
  const displayedDateText = friendlyDateTimeFormatter(displayedDate);
  const isPxiNote = note.identifier.toLowerCase() === "pxi";
  const metadataTitle = getSpanNoteMetadataTitle({ note, username });

  useLayoutEffect(() => {
    if (!isNewNote) {
      return;
    }
    // An instant jump avoids intersecting deferred sections between the
    // current viewport and the note; those sections keep their reserved space.
    noteFooterRef.current?.scrollIntoView({
      behavior: "auto",
      block: "nearest",
      inline: "nearest",
    });
  }, [isNewNote]);

  useLayoutEffect(() => {
    if (!isEditing) {
      return;
    }
    textareaRef.current?.focus({ preventScroll: true });
    noteFrameRef.current?.scrollIntoView({
      behavior: "auto",
      block: "nearest",
      inline: "nearest",
    });
  }, [isEditing]);

  const handleConfirmDelete = async () => {
    if (isDeleting) {
      return;
    }
    setDeleteError(null);
    setIsDeleting(true);
    const result = await onDeleteNote(note.id);
    if (!result.success) {
      setDeleteError(result.error);
      setIsDeleting(false);
    }
  };

  const handleStartEditing = () => {
    setDeleteError(null);
    setEditError(null);
    setNoteText(originalNoteText);
    setIsEditing(true);
  };

  const handleCancelEditing = () => {
    setEditError(null);
    setNoteText(originalNoteText);
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!canSave) {
      return;
    }
    setEditError(null);
    setIsSaving(true);
    const result = await onUpdateNote({
      noteId: note.id,
      noteText: trimmedNoteText,
    });
    if (!result.success) {
      setEditError(result.error);
      setIsSaving(false);
      return;
    }
    setIsSaving(false);
    setIsEditing(false);
  };

  return (
    <li className="span-note" data-new-note={isNewNote} css={noteCSS}>
      <View
        ref={noteFrameRef}
        data-span-note-frame
        data-framed={isFramed}
        padding={isFramed ? "size-200" : undefined}
        borderWidth={isFramed ? "thin" : undefined}
        borderColor={isFramed ? "default" : undefined}
        borderRadius={isFramed ? "medium" : undefined}
      >
        <Flex direction="column" gap={isFramed ? "size-200" : "size-100"}>
          {isEditing ? (
            <div className="span-note__editor">
              <TextField
                aria-label="Edit note"
                value={noteText}
                onChange={setNoteText}
              >
                <TextArea ref={textareaRef} rows={4} />
              </TextField>
            </div>
          ) : (
            <div className="span-note__text-surface">
              <Text
                className="span-note__text"
                data-confirming-delete={isConfirmingDelete}
              >
                {note.explanation ?? "--"}
              </Text>
            </div>
          )}
          {editError ? <Alert variant="danger">{editError}</Alert> : null}
          {deleteError ? <Alert variant="danger">{deleteError}</Alert> : null}
          <div ref={noteFooterRef} className="span-note__footer">
            {isConfirmingDelete ? (
              <Text>Confirm</Text>
            ) : (
              <div className="span-note__author" title={metadataTitle}>
                <UserPicture
                  name={username}
                  profilePictureUrl={note.user?.profilePictureUrl}
                  size={20}
                />
                <Text size="XS" weight="heavy">
                  {username}
                </Text>
                {isPxiNote ? (
                  <span className="span-note__attribution">
                    <PxiAnimatedGlyph size="S" />
                    <Text color="text-500" size="XS">
                      via pxi
                    </Text>
                  </span>
                ) : null}
                {isEdited ? (
                  <Text color="text-500" size="XS">
                    <time dateTime={note.updatedAt}>
                      {displayedDateText} Edited
                    </time>
                  </Text>
                ) : (
                  <Text color="text-500" size="XS">
                    <time dateTime={note.createdAt}>{displayedDateText}</time>
                  </Text>
                )}
              </div>
            )}
            <Flex
              className="span-note__actions"
              direction="row"
              alignItems="center"
              gap="size-100"
              flex="none"
            >
              {isEditing ? (
                <>
                  <Button
                    type="button"
                    size="S"
                    variant="default"
                    isDisabled={isSaving}
                    onPress={handleCancelEditing}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="S"
                    variant={isDirty ? "primary" : "default"}
                    isDisabled={!canSave}
                    onPress={handleSave}
                  >
                    {isSaving ? "Saving..." : "Save"}
                  </Button>
                </>
              ) : isConfirmingDelete ? (
                <>
                  <Button
                    size="S"
                    variant="quiet"
                    isDisabled={isDeleting}
                    onPress={() => {
                      setDeleteError(null);
                      setIsConfirmingDelete(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="S"
                    variant="quiet-danger"
                    isDisabled={isDeleting}
                    onPress={handleConfirmDelete}
                  >
                    {isDeleting ? "Deleting..." : "Delete"}
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="quiet" size="S" onPress={handleStartEditing}>
                    Edit
                  </Button>
                  <Button
                    size="S"
                    variant="quiet-danger"
                    onPress={() => {
                      setDeleteError(null);
                      setIsConfirmingDelete(true);
                    }}
                  >
                    Delete
                  </Button>
                </>
              )}
            </Flex>
          </div>
        </Flex>
      </View>
    </li>
  );
}
