import { css } from "@emotion/react";
import { formatRelative } from "date-fns/formatRelative";

import type { TokenProps, ViewProps } from "@phoenix/components";
import { Flex, Text, Token, View } from "@phoenix/components";
import { AnnotatorKindToken } from "@phoenix/components/trace/AnnotatorKindToken";
import { UserPicture } from "@phoenix/components/user/UserPicture";
import { formatFloat } from "@phoenix/utils/numberFormatUtils";

import { DocumentAnnotationActionMenu } from "./DocumentAnnotationActionMenu";
import {
  DocumentAnnotationForm,
  type DocumentAnnotation,
} from "./DocumentAnnotationForm";

const DANGER_DOCUMENT_EVALUATION_LABELS = ["irrelevant", "unrelated"];

export type DocumentEvaluation = {
  id: string;
  annotatorKind: string;
  documentPosition: number;
  name: string;
  label: string | null;
  score: number | null;
  explanation: string | null;
  createdAt: string;
  updatedAt: string;
  user: { username: string; profilePictureUrl: string | null } | null;
};

export function DocumentAnnotationItem({
  documentEvaluation,
  spanNodeId,
  documentPosition,
  borderColor,
  tokenColor,
  canAnnotate,
  editingAnnotation,
  existingAnnotationNames,
  nowEpochMs,
  onEdit,
  onSaved,
  onCancel,
}: {
  /** The document evaluation data to display */
  documentEvaluation: DocumentEvaluation;
  /** The relay node ID of the parent span */
  spanNodeId: string;
  /** The zero-based position of the document within the span's retrieval list */
  documentPosition: number;
  /** Border color token applied to the item's card container */
  borderColor: ViewProps["borderColor"];
  /** Color token used for label and score badges */
  tokenColor: TokenProps["color"];
  /** Whether the current user has permission to annotate */
  canAnnotate: boolean;
  /** The annotation currently being edited, or null if none */
  editingAnnotation: DocumentAnnotation | null;
  /** Names of existing annotations, used to prevent duplicate names in the form */
  existingAnnotationNames: string[];
  /** Reference epoch timestamp (ms) used for relative date formatting */
  nowEpochMs: number;
  /** Called when the user initiates editing of this annotation */
  onEdit: (annotation: DocumentAnnotation) => void;
  /** Called after an annotation is successfully saved */
  onSaved: () => void;
  /** Called when the user cancels editing */
  onCancel: () => void;
}) {
  const evalTokenColor =
    documentEvaluation.label &&
    DANGER_DOCUMENT_EVALUATION_LABELS.includes(documentEvaluation.label)
      ? "var(--global-color-danger)"
      : tokenColor;

  const isEditingThis =
    editingAnnotation != null &&
    editingAnnotation.id === documentEvaluation.id;

  if (isEditingThis) {
    return (
      <View
        padding="size-0"
        borderWidth="thin"
        borderColor={borderColor}
        borderRadius="medium"
        >
          <View paddingX="size-200" paddingTop="size-100">
            <Text size="S" weight="heavy" color="text-700">
              {`Editing: ${editingAnnotation.name}`}
            </Text>
          </View>
          <DocumentAnnotationForm
            spanNodeId={spanNodeId}
            documentPosition={documentPosition}
            existingAnnotation={editingAnnotation}
            existingAnnotationNames={existingAnnotationNames.filter(
              (n) => n !== editingAnnotation.name
            )}
            onSaved={onSaved}
            onCancel={onCancel}
          />
      </View>
    );
  }

  return (
    <View
        padding="size-200"
        borderWidth="thin"
        borderColor={borderColor}
        borderRadius="medium"
      >
        <Flex direction="column" gap="size-50">
          <Flex
            direction="row"
            gap="size-100"
            alignItems="start"
            justifyContent="space-between"
          >
            <Flex
              direction="row"
              gap="size-100"
              alignItems="center"
              wrap="wrap"
            >
              <Text weight="heavy" elementType="h5">
                {documentEvaluation.name}
              </Text>
              {documentEvaluation.label && (
                <Token color={evalTokenColor}>
                  {documentEvaluation.label}
                </Token>
              )}
              {typeof documentEvaluation.score === "number" && (
                <Token color={evalTokenColor}>
                  <Flex direction="row" gap="size-50">
                    <Text size="XS" weight="heavy" color="inherit">
                      score
                    </Text>
                    <Text size="XS">
                      {formatFloat(documentEvaluation.score)}
                    </Text>
                  </Flex>
                </Token>
              )}
            </Flex>
            {documentEvaluation.annotatorKind === "HUMAN" && canAnnotate && (
              <Flex direction="row" gap="size-50" alignItems="center">
                <DocumentAnnotationActionMenu
                  annotationId={documentEvaluation.id}
                  annotationName={documentEvaluation.name}
                  spanNodeId={spanNodeId}
                  onEdit={() =>
                    onEdit({
                      id: documentEvaluation.id,
                      name: documentEvaluation.name,
                      label: documentEvaluation.label,
                      score: documentEvaluation.score,
                      explanation: documentEvaluation.explanation,
                    })
                  }
                />
              </Flex>
            )}
          </Flex>
          <Flex
            direction="row"
            gap="size-100"
            alignItems="center"
            wrap="wrap"
          >
            <AnnotatorKindToken
              kind={
                documentEvaluation.annotatorKind as "HUMAN" | "LLM" | "CODE"
              }
            />
            {documentEvaluation.user && (
              <Flex direction="row" gap="size-50" alignItems="center">
                <UserPicture
                  name={documentEvaluation.user.username}
                  profilePictureUrl={
                    documentEvaluation.user.profilePictureUrl
                  }
                  size={16}
                />
                <Text size="XS" color="text-300">
                  {documentEvaluation.user.username}
                </Text>
              </Flex>
            )}
            <Text color="text-300" size="XS">
              {formatRelative(documentEvaluation.updatedAt, nowEpochMs)}
            </Text>
          </Flex>
          {documentEvaluation.explanation ? (
            <p
              css={css`
                margin-top: var(--global-dimension-static-size-100);
                margin-bottom: 0;
              `}
            >
              {documentEvaluation.explanation}
            </p>
          ) : null}
        </Flex>
    </View>
  );
}
