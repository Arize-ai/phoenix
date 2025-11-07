import { startTransition, useCallback, useRef, useState } from "react";
import { graphql, useMutation } from "react-relay";

import {
  Button,
  ButtonProps,
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
import { NotificationHookParams } from "@phoenix/contexts/NotificationContext";

import { SpanAnnotationActionMenuDeleteMutation } from "./__generated__/SpanAnnotationActionMenuDeleteMutation.graphql";

type SpanAnnotationActionMenuProps = {
  buttonVariant?: ButtonProps["variant"];
  buttonSize?: ButtonProps["size"];
  annotationId: string;
  spanNodeId: string;
  annotationName: string;
  onSpanAnnotationActionSuccess: (notifyProps: NotificationHookParams) => void;
  onSpanAnnotationActionError: (error: Error) => void;
};

enum AnnotationAction {
  DELETE = "deleteAnnotation",
}

export function SpanAnnotationActionMenu(props: SpanAnnotationActionMenuProps) {
  const {
    annotationId,
    spanNodeId,
    annotationName,
    onSpanAnnotationActionSuccess,
    onSpanAnnotationActionError,
    buttonVariant,
    buttonSize,
  } = props;
  const [commitDelete] = useMutation<SpanAnnotationActionMenuDeleteMutation>(
    graphql`
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
    `
  );

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
          setDeleting(false);
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

  const triggerRef = useRef<HTMLButtonElement>(null);
  const [deleting, setDeleting] = useState(false);

  return (
    <>
      {/* Action menu */}
      <DialogTrigger>
        <Button
          ref={triggerRef}
          size={buttonSize}
          variant={buttonVariant}
          leadingVisual={<Icon svg={<Icons.MoreHorizontalOutline />} />}
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

      {/* Delete confirmation dialog */}
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
                    <Flex direction="row" justifyContent="end" gap="size-200">
                      <StopPropagation>
                        <Button onPress={close}>Cancel</Button>
                      </StopPropagation>
                      <Button
                        variant="danger"
                        onPress={() => {
                          handleDelete();
                        }}
                      >
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
