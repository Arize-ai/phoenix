import { startTransition, useCallback, useState } from "react";
import { graphql, useMutation } from "react-relay";

import {
  Button,
  Dialog,
  DialogTrigger,
  Flex,
  Icon,
  Icons,
  ListBox,
  ListBoxItem,
  Modal,
  ModalOverlay,
  Popover,
  Text,
  View,
} from "@phoenix/components";
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@phoenix/components/dialog";
import { StopPropagation } from "@phoenix/components/StopPropagation";
import { useNotifyError, useNotifySuccess } from "@phoenix/contexts";

import type { DocumentAnnotationActionMenuDeleteMutation } from "./__generated__/DocumentAnnotationActionMenuDeleteMutation.graphql";

enum AnnotationAction {
  DELETE = "deleteAnnotation",
}

export function DocumentAnnotationActionMenu({
  annotationId,
  annotationName,
  spanNodeId,
}: {
  annotationId: string;
  annotationName: string;
  spanNodeId: string;
}) {
  const notifySuccess = useNotifySuccess();
  const notifyError = useNotifyError();
  const [deleting, setDeleting] = useState(false);

  const [commitDelete] =
    useMutation<DocumentAnnotationActionMenuDeleteMutation>(graphql`
      mutation DocumentAnnotationActionMenuDeleteMutation(
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

  const handleDelete = useCallback(() => {
    startTransition(() => {
      commitDelete({
        variables: {
          input: { annotationIds: [annotationId] },
          spanId: spanNodeId,
        },
        onCompleted: () => {
          notifySuccess({
            title: "Annotation deleted",
            message: `Annotation "${annotationName}" has been deleted.`,
          });
          setDeleting(false);
        },
        onError: (error) => {
          notifyError({
            title: "Error deleting annotation",
            message: error.message,
          });
        },
      });
    });
  }, [
    commitDelete,
    annotationId,
    spanNodeId,
    annotationName,
    notifySuccess,
    notifyError,
  ]);

  return (
    <>
      <DialogTrigger>
        <Button
          size="S"
          variant="default"
          leadingVisual={<Icon svg={<Icons.MoreHorizontalOutline />} />}
          aria-label={`Actions for annotation ${annotationName}`}
        />
        <Popover>
          <Dialog>
            {({ close }) => (
              <ListBox style={{ minHeight: "auto" }}>
                <ListBoxItem
                  id={AnnotationAction.DELETE}
                  onAction={() => {
                    setDeleting(true);
                    close();
                  }}
                >
                  <Flex
                    direction="row"
                    gap="size-75"
                    justifyContent="start"
                    alignItems="center"
                  >
                    <Icon svg={<Icons.TrashOutline />} />
                    <Text>Delete</Text>
                  </Flex>
                </ListBoxItem>
              </ListBox>
            )}
          </Dialog>
        </Popover>
      </DialogTrigger>

      <DialogTrigger isOpen={deleting} onOpenChange={setDeleting}>
        <ModalOverlay>
          <Modal>
            <Dialog>
              {({ close }) => (
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Delete Annotation</DialogTitle>
                  </DialogHeader>
                  <View padding="size-200">
                    <Text color="danger">
                      {`Are you sure you want to delete annotation "${annotationName}"? This cannot be undone.`}
                    </Text>
                  </View>
                  <View
                    paddingEnd="size-200"
                    paddingTop="size-100"
                    paddingBottom="size-100"
                    borderTopColor="light"
                    borderTopWidth="thin"
                  >
                    <Flex direction="row" justifyContent="end" gap="size-200">
                      <StopPropagation>
                        <Button onPress={close}>Cancel</Button>
                      </StopPropagation>
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
    </>
  );
}
