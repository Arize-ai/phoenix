import { startTransition, useCallback, useState } from "react";
import { graphql, useMutation } from "react-relay";

import {
  Button,
  Dialog,
  DialogTrigger,
  Flex,
  Icon,
  Icons,
  Modal,
  ModalOverlay,
  Text,
  View,
} from "@phoenix/components";
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@phoenix/components/core/dialog";
import type { NotificationHookParams } from "@phoenix/contexts/NotificationContext";

import type { SessionAnnotationDeleteButtonMutation } from "./__generated__/SessionAnnotationDeleteButtonMutation.graphql";

type SessionAnnotationDeleteButtonProps = {
  annotationId: string;
  sessionNodeId: string;
  annotationName: string;
  onDeleteSuccess: (notifyProps: NotificationHookParams) => void;
  onDeleteError: (error: Error) => void;
};

/**
 * Deletes a single session annotation, confirming with the user first.
 */
export function SessionAnnotationDeleteButton(
  props: SessionAnnotationDeleteButtonProps
) {
  const {
    annotationId,
    sessionNodeId,
    annotationName,
    onDeleteSuccess,
    onDeleteError,
  } = props;
  const [deleting, setDeleting] = useState(false);
  const [commitDelete] = useMutation<SessionAnnotationDeleteButtonMutation>(
    graphql`
      mutation SessionAnnotationDeleteButtonMutation(
        $annotationId: ID!
        $sessionId: ID!
      ) {
        deleteProjectSessionAnnotation(id: $annotationId) {
          query {
            node(id: $sessionId) {
              ... on ProjectSession {
                ...SessionAnnotationsEditor_sessionAnnotations
                ...SessionAnnotationsTable_annotations
                ...SessionAnnotationSummaryGroup
              }
            }
          }
        }
      }
    `
  );

  const handleDelete = useCallback(() => {
    startTransition(() => {
      commitDelete({
        variables: {
          annotationId,
          sessionId: sessionNodeId,
        },
        onCompleted: () => {
          onDeleteSuccess({
            title: "Annotation Deleted",
            message: `Annotation ${annotationName} has been deleted.`,
          });
          setDeleting(false);
        },
        onError: (error) => {
          onDeleteError(error);
        },
      });
    });
  }, [
    commitDelete,
    annotationId,
    sessionNodeId,
    onDeleteSuccess,
    annotationName,
    onDeleteError,
  ]);

  return (
    <DialogTrigger isOpen={deleting} onOpenChange={setDeleting}>
      <Button
        size="S"
        variant="quiet"
        aria-label={`Delete annotation ${annotationName}`}
        leadingVisual={<Icon svg={<Icons.Trash />} />}
      />
      <ModalOverlay>
        <Modal size="S">
          <Dialog>
            {({ close }) => (
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete Annotation</DialogTitle>
                </DialogHeader>
                <View padding="size-200">
                  <Text color="danger">
                    {`Are you sure you want to delete annotation ${annotationName}? This cannot be undone.`}
                  </Text>
                </View>
                <View
                  paddingEnd="size-200"
                  paddingTop="size-100"
                  paddingBottom="size-100"
                  borderTopColor="default"
                  borderTopWidth="thin"
                >
                  <Flex direction="row" justifyContent="end" gap="size-200">
                    <Button onPress={close}>Cancel</Button>
                    <Button variant="danger" onPress={handleDelete}>
                      Delete Annotation
                    </Button>
                  </Flex>
                </View>
              </DialogContent>
            )}
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
