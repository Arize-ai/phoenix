import { ReactNode, startTransition, useCallback, useState } from "react";
import { graphql, useMutation } from "react-relay";

import { Dialog, DialogContainer } from "@arizeai/components";
import { NoticeConfig } from "@arizeai/components/dist/notification/types";

import { Button, Flex, Text, View } from "@phoenix/components";

import { SpanAnnotationActionMenuDeleteMutation } from "./__generated__/SpanAnnotationActionMenuDeleteMutation.graphql";
import {
  AnnotationActionMenu,
  AnnotationActionMenuProps,
} from "./AnnotationActionMenu";

type SpanAnnotationActionMenuProps = Pick<
  AnnotationActionMenuProps,
  "buttonVariant" | "buttonSize"
> & {
  annotationId: string;
  spanNodeId: string;
  annotationName: string;
  onSpanAnnotationActionSuccess: (
    notifyProps: Omit<NoticeConfig, "variant">
  ) => void;
  onSpanAnnotationActionError: (error: Error) => void;
};

export function SpanAnnotationActionMenu(props: SpanAnnotationActionMenuProps) {
  const {
    annotationId,
    spanNodeId,
    annotationName,
    onSpanAnnotationActionSuccess,
    onSpanAnnotationActionError,
    buttonVariant = "quiet",
    buttonSize = "compact",
  } = props;
  const [confirmDialog, setConfirmDialog] = useState<ReactNode>(null);
  const [commitDelete, isCommittingDelete] =
    useMutation<SpanAnnotationActionMenuDeleteMutation>(graphql`
      mutation SpanAnnotationActionMenuDeleteMutation(
        $annotationId: ID!
        $spanId: ID!
      ) {
        deleteSpanAnnotations(input: { annotationIds: [$annotationId] }) {
          query {
            node(id: $spanId) {
              ... on Span {
                ...SpanAnnotationsEditor_spanAnnotations
                ...SpanFeedback_annotations
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
          onSpanAnnotationActionSuccess({
            title: "Annotation Deleted",
            message: `Annotation ${annotationName} has been deleted.`,
          });
        },
        onError: (error) => {
          onSpanAnnotationActionError(error);
        },
      });
    });
  }, [
    commitDelete,
    annotationId,
    spanNodeId,
    onSpanAnnotationActionSuccess,
    annotationName,
    onSpanAnnotationActionError,
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
              onPress={() => {
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
        buttonVariant={buttonVariant}
        buttonSize={buttonSize}
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
