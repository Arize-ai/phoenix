import { formatRelative } from "date-fns/formatRelative";

import type { TokenProps, ViewProps } from "@phoenix/components";
import { Flex, Text, Token, View } from "@phoenix/components";
import { AnnotatorKindToken } from "@phoenix/components/trace/AnnotatorKindToken";
import { UserPicture } from "@phoenix/components/user/UserPicture";
import { formatFloat } from "@phoenix/utils/numberFormatUtils";

import { DocumentAnnotationActionMenu } from "./DocumentAnnotationActionMenu";
import {
  DocumentAnnotationForm,
  type DocumentAnnotationFormData,
} from "./DocumentAnnotationForm";

const DANGER_ANNOTATION_LABELS = ["irrelevant", "unrelated"];
const ANNOTATOR_KINDS = new Set(["HUMAN", "LLM", "CODE"] as const);
type AnnotatorKind = "HUMAN" | "LLM" | "CODE";

function isAnnotatorKind(value: string): value is AnnotatorKind {
  return ANNOTATOR_KINDS.has(value as AnnotatorKind);
}

export type DocumentAnnotation = {
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
  documentAnnotation,
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
  /** The document annotation data to display */
  documentAnnotation: DocumentAnnotation;
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
  editingAnnotation: DocumentAnnotationFormData | null;
  /** Names of existing annotations, used to prevent duplicate names in the form */
  existingAnnotationNames: string[];
  /** Reference epoch timestamp (ms) used for relative date formatting */
  nowEpochMs: number;
  /** Called when the user initiates editing of this annotation */
  onEdit: (annotation: DocumentAnnotationFormData) => void;
  /** Called after an annotation is successfully saved */
  onSaved: () => void;
  /** Called when the user cancels editing */
  onCancel: () => void;
}) {
  const evalTokenColor =
    documentAnnotation.label &&
    DANGER_ANNOTATION_LABELS.includes(documentAnnotation.label)
      ? "var(--global-color-danger)"
      : tokenColor;

  const isEditing =
    editingAnnotation != null &&
    editingAnnotation.id === documentAnnotation.id;

  if (isEditing) {
    return (
      <View
        borderWidth="thin"
        borderColor={borderColor}
        borderRadius="medium"
      >
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

  const hasDetails =
    documentAnnotation.label != null ||
    typeof documentAnnotation.score === "number" ||
    isAnnotatorKind(documentAnnotation.annotatorKind);

  return (
    <View
      padding="size-200"
      borderWidth="thin"
      borderColor={borderColor}
      borderRadius="medium"
    >
      <Flex direction="column" gap="size-100">
        <Flex
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          gap="size-100"
        >
          <Text weight="heavy" elementType="h5">
            {documentAnnotation.name}
          </Text>
          <Flex
            direction="row"
            gap="size-75"
            alignItems="center"
            wrap="wrap"
          >
            <Flex direction="row" gap="size-50" alignItems="center">
              <UserPicture
                name={documentAnnotation.user?.username || "system"}
                profilePictureUrl={
                  documentAnnotation.user?.profilePictureUrl || null
                }
                size={16}
              />
              <Text size="XS" color="text-300">
                {documentAnnotation.user?.username || "system"}
              </Text>
            </Flex>
            <Text color="text-300" size="XS">
              {formatRelative(documentAnnotation.updatedAt, nowEpochMs)}
            </Text>
            {canAnnotate && (
              <DocumentAnnotationActionMenu
                annotationId={documentAnnotation.id}
                annotationName={documentAnnotation.name}
                spanNodeId={spanNodeId}
                onEdit={() =>
                  onEdit({
                    id: documentAnnotation.id,
                    name: documentAnnotation.name,
                    label: documentAnnotation.label,
                    score: documentAnnotation.score,
                    explanation: documentAnnotation.explanation,
                  })
                }
              />
            )}
          </Flex>
        </Flex>
        {hasDetails && (
          <Flex direction="row" gap="size-200" alignItems="center" wrap="wrap">
            {documentAnnotation.label && (
              <Flex direction="row" gap="size-100" alignItems="center">
                <Text size="XS" color="text-900" weight="heavy">
                  Label
                </Text>
                <Token color={evalTokenColor}>
                  {documentAnnotation.label}
                </Token>
              </Flex>
            )}
            {typeof documentAnnotation.score === "number" && (
              <Flex direction="row" gap="size-100" alignItems="center">
                <Text size="XS" color="text-900" weight="heavy">
                  Score
                </Text>
                <Token color={evalTokenColor}>
                  {formatFloat(documentAnnotation.score)}
                </Token>
              </Flex>
            )}
            {isAnnotatorKind(documentAnnotation.annotatorKind) && (
              <Flex direction="row" gap="size-100" alignItems="center">
                <Text size="XS" color="text-900" weight="heavy">
                  Kind
                </Text>
                <AnnotatorKindToken
                  kind={documentAnnotation.annotatorKind}
                />
              </Flex>
            )}
          </Flex>
        )}
        {documentAnnotation.explanation ? (
          <Flex direction="column" gap="size-50">
            <Text size="XS" color="text-900" weight="heavy">
              Explanation
            </Text>
            <Text>{documentAnnotation.explanation}</Text>
          </Flex>
        ) : null}
      </Flex>
    </View>
  );
}
