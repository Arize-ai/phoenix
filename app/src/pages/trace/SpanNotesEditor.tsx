import React, { startTransition, useState } from "react";
import { graphql, useLazyLoadQuery, useMutation } from "react-relay";
import { css } from "@emotion/react";

import { Flex, View } from "@phoenix/components";
import {
  MessageBar,
  MessageBubble,
  MessageBubbleSkeleton,
} from "@phoenix/components/chat";

import { SpanNotesEditorAddNoteMutation } from "./__generated__/SpanNotesEditorAddNoteMutation.graphql";
import { SpanNotesEditorQuery } from "./__generated__/SpanNotesEditorQuery.graphql";

type SpanNotesEditorProps = {
  spanNodeId: string;
};

const notesListCSS = css`
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--ac-global-dimension-size-100);
  padding: var(--ac-global-dimension-size-100);
  box-sizing: border-box;
  li {
    width: 100%;
  }
`;

export function SpanNotesEditor(props: SpanNotesEditorProps) {
  const [fetchKey, setFetchKey] = useState(0);
  // TODO: add filter by note annotations
  const data = useLazyLoadQuery<SpanNotesEditorQuery>(
    graphql`
      query SpanNotesEditorQuery($spanNodeId: GlobalID!) {
        viewer {
          id
          username
          profilePictureUrl
        }
        span: node(id: $spanNodeId) {
          ... on Span {
            spanAnnotations {
              id
              name
              explanation
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
    {
      spanNodeId: props.spanNodeId,
    },
    { fetchKey }
  );

  const [addNote, isAddingNote] = useMutation<SpanNotesEditorAddNoteMutation>(
    graphql`
      mutation SpanNotesEditorAddNoteMutation(
        $input: CreateSpanAnnotationInput!
        $spanId: GlobalID!
      ) {
        createSpanAnnotations(input: [$input]) {
          query {
            node(id: $spanId) {
              ... on Span {
                ...SpanAnnotationsEditor_spanAnnotations
              }
            }
          }
        }
      }
    `
  );

  const onAddNote = (note: string) => {
    startTransition(() => {
      addNote({
        variables: {
          input: {
            name: "note",
            explanation: note,
            annotatorKind: "HUMAN",
            source: "APP",
            spanId: props.spanNodeId,
          },
          spanId: props.spanNodeId,
        },
      });
      setFetchKey(fetchKey + 1);
    });
  };

  const annotations = data.span?.spanAnnotations || [];

  const notes = annotations.filter(
    // TODO: remove this hard coding
    (annotation) => annotation.name === "note"
  );

  return (
    <Flex direction="column" height="100%" justifyContent="space-between">
      <ul css={notesListCSS}>
        {notes.map((note) => (
          <li key={note.id}>
            <MessageBubble
              text={note.explanation || ""}
              // TODO: plumb through
              timestamp={new Date()}
              userName={note.user?.username || "system"}
              userPicture={note.user?.profilePictureUrl}
              isOutgoing={note.user?.id === data.viewer?.id}
            />
          </li>
        ))}
      </ul>

      <MessageBar
        onSendMessage={onAddNote}
        placeholder="Add a note"
        isSending={isAddingNote}
      />
    </Flex>
  );
}

export function SpanNotesEditorSkeleton() {
  return (
    <Flex direction="column" height="100%" justifyContent="space-between">
      <View padding="size-100">
        <Flex direction="column" gap="size-100" height="100%">
          <MessageBubbleSkeleton isOutgoing={false} height={70} />
          <MessageBubbleSkeleton isOutgoing={true} height={40} />
        </Flex>
      </View>
      <MessageBar onSendMessage={() => {}} placeholder="Add a note" />
    </Flex>
  );
}
