import { css } from "@emotion/react";
import { useCallback, useState } from "react";
import { TextArea } from "react-aria-components";
import { graphql, useMutation } from "react-relay";

import {
  Button,
  Flex,
  Heading,
  Icon,
  Icons,
  Text,
  TextField,
  View,
} from "@phoenix/components";
import { useNotifyError, useNotifySuccess } from "@phoenix/contexts";

import type { DocumentAnnotationFormCreateMutation } from "./__generated__/DocumentAnnotationFormCreateMutation.graphql";
import type { DocumentAnnotationFormDeleteMutation } from "./__generated__/DocumentAnnotationFormDeleteMutation.graphql";
import type { DocumentAnnotationFormPatchMutation } from "./__generated__/DocumentAnnotationFormPatchMutation.graphql";

type DocumentAnnotation = {
  id: string;
  label: string | null;
  score: number | null;
  explanation: string | null;
};

const ANNOTATION_NAME = "relevance";

const relevanceButtonCSS = css`
  min-width: 90px;
`;

export function DocumentAnnotationForm({
  spanNodeId,
  documentPosition,
  existingAnnotation,
  onDismiss,
}: {
  spanNodeId: string;
  documentPosition: number;
  existingAnnotation?: DocumentAnnotation | null;
  onDismiss?: () => void;
}) {
  const notifyError = useNotifyError();
  const notifySuccess = useNotifySuccess();

  const [selectedRelevance, setSelectedRelevance] = useState<
    "relevant" | "irrelevant" | null
  >(
    existingAnnotation?.label === "relevant"
      ? "relevant"
      : existingAnnotation?.label === "irrelevant"
        ? "irrelevant"
        : null
  );
  const [note, setNote] = useState(existingAnnotation?.explanation ?? "");

  const [commitCreate, isCreating] =
    useMutation<DocumentAnnotationFormCreateMutation>(graphql`
      mutation DocumentAnnotationFormCreateMutation(
        $input: [CreateDocumentAnnotationInput!]!
        $spanId: ID!
      ) {
        createDocumentAnnotations(input: $input) {
          query {
            node(id: $spanId) {
              ... on Span {
                documentEvaluations {
                  id
                  annotatorKind
                  documentPosition
                  name
                  label
                  score
                  explanation
                }
              }
            }
          }
        }
      }
    `);

  const [commitPatch, isPatching] =
    useMutation<DocumentAnnotationFormPatchMutation>(graphql`
      mutation DocumentAnnotationFormPatchMutation(
        $input: [PatchAnnotationInput!]!
        $spanId: ID!
      ) {
        patchDocumentAnnotations(input: $input) {
          query {
            node(id: $spanId) {
              ... on Span {
                documentEvaluations {
                  id
                  annotatorKind
                  documentPosition
                  name
                  label
                  score
                  explanation
                }
              }
            }
          }
        }
      }
    `);

  const [commitDelete, isDeleting] =
    useMutation<DocumentAnnotationFormDeleteMutation>(graphql`
      mutation DocumentAnnotationFormDeleteMutation(
        $input: DeleteAnnotationsInput!
        $spanId: ID!
      ) {
        deleteDocumentAnnotations(input: $input) {
          query {
            node(id: $spanId) {
              ... on Span {
                documentEvaluations {
                  id
                  annotatorKind
                  documentPosition
                  name
                  label
                  score
                  explanation
                }
              }
            }
          }
        }
      }
    `);

  const isBusy = isCreating || isPatching || isDeleting;

  const handleSave = useCallback(() => {
    if (selectedRelevance == null) {
      return;
    }
    const label = selectedRelevance;
    const score = selectedRelevance === "relevant" ? 1 : 0;
    const explanation = note.trim() || null;

    if (existingAnnotation) {
      commitPatch({
        variables: {
          input: [
            {
              annotationId: existingAnnotation.id,
              name: ANNOTATION_NAME,
              label,
              score,
              explanation,
              annotatorKind: "HUMAN",
              source: "APP",
            },
          ],
          spanId: spanNodeId,
        },
        onCompleted: () => {
          notifySuccess({
            title: "Annotation updated",
            message: "Document annotation saved successfully.",
          });
        },
        onError: (error) => {
          notifyError({
            title: "Error updating annotation",
            message: error.message,
          });
        },
      });
    } else {
      commitCreate({
        variables: {
          input: [
            {
              spanId: spanNodeId,
              documentPosition,
              name: ANNOTATION_NAME,
              annotatorKind: "HUMAN",
              label,
              score,
              explanation,
              metadata: {},
              source: "APP",
            },
          ],
          spanId: spanNodeId,
        },
        onCompleted: () => {
          notifySuccess({
            title: "Annotation created",
            message: "Document annotation saved successfully.",
          });
        },
        onError: (error) => {
          notifyError({
            title: "Error creating annotation",
            message: error.message,
          });
        },
      });
    }
  }, [
    selectedRelevance,
    note,
    existingAnnotation,
    commitPatch,
    commitCreate,
    spanNodeId,
    documentPosition,
    notifySuccess,
    notifyError,
  ]);

  const handleDelete = useCallback(() => {
    if (!existingAnnotation) {
      return;
    }
    commitDelete({
      variables: {
        input: {
          annotationIds: [existingAnnotation.id],
        },
        spanId: spanNodeId,
      },
      onCompleted: () => {
        notifySuccess({
          title: "Annotation deleted",
          message: "Document annotation removed.",
        });
        onDismiss?.();
      },
      onError: (error) => {
        notifyError({
          title: "Error deleting annotation",
          message: error.message,
        });
      },
    });
  }, [
    existingAnnotation,
    commitDelete,
    spanNodeId,
    notifySuccess,
    notifyError,
    onDismiss,
  ]);

  return (
    <View padding="size-200">
      <Flex direction="column" gap="size-100">
        <Heading level={4} weight="heavy">
          Annotation
        </Heading>
        <Flex direction="column" gap="size-100">
          <Text size="S" weight="heavy">
            Relevance
          </Text>
          <Flex direction="row" gap="size-100">
            <Button
              css={relevanceButtonCSS}
              variant={
                selectedRelevance === "relevant" ? "primary" : "default"
              }
              size="S"
              onPress={() => setSelectedRelevance("relevant")}
            >
              Relevant
            </Button>
            <Button
              css={relevanceButtonCSS}
              variant={
                selectedRelevance === "irrelevant" ? "danger" : "default"
              }
              size="S"
              onPress={() => setSelectedRelevance("irrelevant")}
            >
              Irrelevant
            </Button>
          </Flex>
        </Flex>
        <TextField
          value={note}
          onChange={setNote}
          css={css`
            width: 100%;
          `}
        >
          <Text size="S" weight="heavy">
            Note
          </Text>
          <TextArea
            rows={2}
            css={css`
              resize: vertical;
            `}
          />
        </TextField>
        <Flex direction="row" gap="size-100" justifyContent="end">
          {existingAnnotation && (
            <Button
              variant="danger"
              size="S"
              leadingVisual={<Icon svg={<Icons.TrashOutline />} />}
              onPress={handleDelete}
              isDisabled={isBusy}
            >
              Delete
            </Button>
          )}
          <Button
            variant="primary"
            size="S"
            onPress={handleSave}
            isDisabled={selectedRelevance == null || isBusy}
          >
            Save
          </Button>
        </Flex>
      </Flex>
    </View>
  );
}
