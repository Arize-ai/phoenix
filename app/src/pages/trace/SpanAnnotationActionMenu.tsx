import React, {
  ReactNode,
  startTransition,
  useCallback,
  useState,
} from "react";
import { graphql, useMutation } from "react-relay";

import {
  Button,
  Dialog,
  DialogContainer,
  Flex,
  Text,
  View,
} from "@arizeai/components";

import { SpanAnnotationActionMenuDeleteMutation } from "./__generated__/SpanAnnotationActionMenuDeleteMutation.graphql";
import { AnnotationActionMenu } from "./AnnotationActionMenu";

type SpanAnnotationActionMenuProps = {
  annotationId: string;
  spanNodeId: string;
  annotationName: string;
  onSpanAnnotationDelete: () => void;
  onSpanAnnotationDeleteError: (error: Error) => void;
};

export function SpanAnnotationActionMenu(props: SpanAnnotationActionMenuProps) {
  const {
    annotationId,
    spanNodeId,
    annotationName,
    onSpanAnnotationDelete,
    onSpanAnnotationDeleteError,
  } = props;
  const [confirmDialog, setConfirmDialog] = useState<ReactNode>(null);
  const [commitDelete, isCommittingDelete] =
    useMutation<SpanAnnotationActionMenuDeleteMutation>(graphql`
      mutation SpanAnnotationActionMenuDeleteMutation(
        $annotationId: GlobalID!
        $spanId: GlobalID!
      ) {
        deleteSpanAnnotations(input: { annotationIds: [$annotationId] }) {
          query {
            node(id: $spanId) {
              ... on Span {
                ...EditSpanAnnotationsDialog_spanAnnotations
              }
            }
          }
        }
      }
    `);

  const handleDelete = useCallback(() => {
    startTransition(() => {
      commitDelete({
        variables: {
          annotationId,
          spanId: spanNodeId,
        },
        onCompleted: () => {
          onSpanAnnotationDelete();
        },
        onError: (error) => {
          onSpanAnnotationDeleteError(error);
        },
      });
    });
  }, [
    commitDelete,
    annotationId,
    spanNodeId,
    onSpanAnnotationDelete,
    onSpanAnnotationDeleteError,
  ]);
  const onDelete = useCallback(() => {
    setConfirmDialog(
      <Dialog size="S" title="Delete Annotation">
        <View padding="size-200">
          <Text color="danger">
            {`Are you sure you want to delete annotation ${annotationName}? This cannot be undone.`}
          </Text>
        </View>
        <View
          paddingEnd="size-200"
          paddingTop="size-100"
          paddingBottom="size-100"
          borderTopColor="light"
          borderTopWidth="thin"
        >
          <Flex direction="row" justifyContent="end">
            <Button
              variant="danger"
              onClick={() => {
                handleDelete();
                setConfirmDialog(null);
              }}
            >
              Delete Annotation
            </Button>
          </Flex>
        </View>
      </Dialog>
    );
  }, [handleDelete, annotationName]);
  return (
    <div>
      <AnnotationActionMenu
        onDelete={onDelete}
        isDisabled={isCommittingDelete}
      />
      <DialogContainer
        type="modal"
        isDismissable
        onDismiss={() => setConfirmDialog(null)}
      >
        {confirmDialog}
      </DialogContainer>
    </div>
  );
}
