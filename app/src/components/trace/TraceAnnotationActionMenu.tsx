import { startTransition, useCallback, useRef, useState } from "react";
import { graphql, useMutation } from "react-relay";

import type { ButtonProps } from "@phoenix/components";
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
} from "@phoenix/components/core/dialog";
import { StopPropagation } from "@phoenix/components/StopPropagation";
import type { NotificationHookParams } from "@phoenix/contexts/NotificationContext";

import type { TraceAnnotationActionMenuDeleteMutation } from "./__generated__/TraceAnnotationActionMenuDeleteMutation.graphql";

type TraceAnnotationActionMenuProps = {
  buttonVariant?: ButtonProps["variant"];
  buttonSize?: ButtonProps["size"];
  annotationId: string;
  traceNodeId: string;
  spanNodeId: string;
  annotationName: string;
  onTraceAnnotationActionSuccess: (notifyProps: NotificationHookParams) => void;
  onTraceAnnotationActionError: (error: Error) => void;
};

enum AnnotationAction {
  DELETE = "deleteAnnotation",
}

export function TraceAnnotationActionMenu(
  props: TraceAnnotationActionMenuProps
) {
  const {
    annotationId,
    traceNodeId,
    spanNodeId,
    annotationName,
    onTraceAnnotationActionSuccess,
    onTraceAnnotationActionError,
    buttonVariant,
    buttonSize,
  } = props;
  const [deleting, setDeleting] = useState(false);
  const [commitDelete] = useMutation<TraceAnnotationActionMenuDeleteMutation>(
    graphql`
      mutation TraceAnnotationActionMenuDeleteMutation(
        $annotationId: ID!
        $traceId: ID!
        $spanId: ID!
      ) {
        deleteTraceAnnotations(input: { annotationIds: [$annotationId] }) {
          query {
            trace: node(id: $traceId) {
              ... on Trace {
                ...TraceAnnotationSummaryGroup
              }
            }
            span: node(id: $spanId) {
              ... on Span {
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
          traceId: traceNodeId,
          spanId: spanNodeId,
        },
        onCompleted: () => {
          onTraceAnnotationActionSuccess({
            title: "Annotation Deleted",
            message: `Annotation ${annotationName} has been deleted.`,
          });
          setDeleting(false);
        },
        onError: (error) => {
          onTraceAnnotationActionError(error);
        },
      });
    });
  }, [
    commitDelete,
    annotationId,
    traceNodeId,
    spanNodeId,
    onTraceAnnotationActionSuccess,
    annotationName,
    onTraceAnnotationActionError,
  ]);

  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <>
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
                    borderTopColor="default"
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
