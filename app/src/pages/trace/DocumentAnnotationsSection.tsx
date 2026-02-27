import { useCallback, useMemo, useState } from "react";

import type { TokenProps, ViewProps } from "@phoenix/components";
import {
  Button,
  Flex,
  Heading,
  Icon,
  Icons,
  View,
} from "@phoenix/components";

import {
  DocumentAnnotationItem,
  type DocumentEvaluation,
} from "./DocumentAnnotationItem";
import {
  DocumentAnnotationForm,
  type DocumentAnnotation,
} from "./DocumentAnnotationForm";

export function DocumentAnnotationsSection({
  spanNodeId,
  documentPosition,
  documentEvaluations,
  borderColor,
  tokenColor,
  canAnnotate,
}: {
  spanNodeId: string;
  documentPosition: number;
  documentEvaluations: DocumentEvaluation[];
  borderColor: ViewProps["borderColor"];
  tokenColor: TokenProps["color"];
  canAnnotate: boolean;
}) {
  const [editingAnnotation, setEditingAnnotation] =
    useState<DocumentAnnotation | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const isEditing = editingAnnotation != null || isCreating;

  const nowEpochMs = useMemo(() => Date.now(), []);

  const existingAnnotationNames = useMemo(
    () => documentEvaluations.map((e) => e.name),
    [documentEvaluations]
  );

  const handleCancel = useCallback(() => {
    setEditingAnnotation(null);
    setIsCreating(false);
  }, []);

  const handleSaved = useCallback(() => {
    setEditingAnnotation(null);
    setIsCreating(false);
  }, []);

  return (
    <View borderColor={borderColor} borderTopWidth="thin" padding="size-200">
      <Flex direction="column" gap="size-100">
        <Flex
          direction="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Heading level={3} weight="heavy">
            Document Annotations
          </Heading>
          {canAnnotate && (
            <Button
              size="S"
              leadingVisual={<Icon svg={<Icons.PlusOutline />} />}
              onPress={() => setIsCreating(true)}
              isDisabled={isEditing}
              aria-label="Add Annotation"
            >
              Annotation
            </Button>
          )}
        </Flex>
        {isCreating && (
          <View
            borderWidth="thin"
            borderColor={borderColor}
            borderRadius="medium"
          >
            <DocumentAnnotationForm
              spanNodeId={spanNodeId}
              documentPosition={documentPosition}
              existingAnnotationNames={existingAnnotationNames}
              onSaved={handleSaved}
              onCancel={handleCancel}
            />
          </View>
        )}
        {documentEvaluations.length > 0 && (
          <Flex direction="column" gap="size-100" elementType="ul">
            {documentEvaluations.map((documentEvaluation) => (
              <DocumentAnnotationItem
                key={documentEvaluation.id}
                documentEvaluation={documentEvaluation}
                spanNodeId={spanNodeId}
                documentPosition={documentPosition}
                borderColor={borderColor}
                tokenColor={tokenColor}
                canAnnotate={canAnnotate}
                editingAnnotation={editingAnnotation}
                existingAnnotationNames={existingAnnotationNames}
                nowEpochMs={nowEpochMs}
                onEdit={setEditingAnnotation}
                onSaved={handleSaved}
                onCancel={handleCancel}
              />
            ))}
          </Flex>
        )}
      </Flex>
    </View>
  );
}
