import { startTransition, useMemo, useState } from "react";
import { graphql, useMutation } from "react-relay";

import {
  Button,
  Dialog,
  DialogTrigger,
  Icon,
  Icons,
  Modal,
  ModalOverlay,
  Text,
  Tooltip,
  TooltipTrigger,
  View,
} from "@phoenix/components";
import {
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@phoenix/components/core/dialog";
import type { NotificationHookParams } from "@phoenix/contexts/NotificationContext";
import { useViewer } from "@phoenix/contexts/ViewerContext";

import type { SpanAnnotationDeleteButtonMutation } from "./__generated__/SpanAnnotationDeleteButtonMutation.graphql";

type SpanAnnotationDeleteButtonProps = {
  annotationId: string;
  spanNodeId: string;
  /**
   * The annotation's name, where naming it tells the reader which one they are
   * about to lose. Left out where every annotation on the surface has the same
   * name — the notes table, whose rows are all named "note".
   */
  annotationName?: string;
  /**
   * What the annotation is called in the confirmation and the notification.
   * Notes are annotations, but "delete the annotation note" reads wrong.
   * @default "annotation"
   */
  noun?: string;
  onDeleteSuccess: (notifyProps: NotificationHookParams) => void;
  onDeleteError: (error: Error) => void;
};

/**
 * Deletes a single span annotation, confirming with the user first.
 */
export function SpanAnnotationDeleteButton({
  annotationId,
  spanNodeId,
  annotationName,
  noun = "annotation",
  onDeleteSuccess,
  onDeleteError,
}: SpanAnnotationDeleteButtonProps) {
  const Noun = `${noun[0].toUpperCase()}${noun.slice(1)}`;
  // named where there is a name to give, and referred to as "this one" where
  // the surface has already established what it is
  const target = annotationName
    ? `the ${noun} ${annotationName}`
    : `this ${noun}`;
  const [isConfirming, setIsConfirming] = useState(false);
  // The editor in the aside reads the viewer's own annotations, so the refetch
  // below has to ask for that same slice — the unfiltered one is stored under a
  // different key and would leave the editor holding the deleted annotation.
  // Unauthenticated, a null user id selects the system annotations.
  const { viewer } = useViewer();
  const userFilter = useMemo(() => (viewer ? [viewer.id] : [null]), [viewer]);
  const [commitDelete] = useMutation<SpanAnnotationDeleteButtonMutation>(
    graphql`
      mutation SpanAnnotationDeleteButtonMutation(
        $annotationId: ID!
        $spanId: ID!
        $filterUserIds: [ID]
      ) {
        deleteSpanAnnotations(input: { annotationIds: [$annotationId] }) {
          query {
            node(id: $spanId) {
              ... on Span {
                # the summaries are what the cards and the trace header read;
                # without them a delete leaves a mean score behind that the
                # table beside it no longer has the annotations to support
                ...AnnotationSummaryGroup
                ...SpanAnnotationsEditor_spanAnnotations
                  @arguments(filterUserIds: $filterUserIds)
                ...SpanAnnotationsTable_annotations
              }
            }
          }
        }
      }
    `
  );

  const handleDelete = () => {
    startTransition(() => {
      commitDelete({
        variables: {
          annotationId,
          spanId: spanNodeId,
          filterUserIds: userFilter,
        },
        onCompleted: () => {
          onDeleteSuccess({
            title: `${Noun} Deleted`,
            message: `${
              annotationName ? `${Noun} ${annotationName}` : Noun
            } has been deleted.`,
          });
          setIsConfirming(false);
        },
        onError: (error) => {
          onDeleteError(error);
        },
      });
    });
  };

  const label = annotationName
    ? `Delete ${noun} ${annotationName}`
    : `Delete ${noun}`;
  return (
    <DialogTrigger isOpen={isConfirming} onOpenChange={setIsConfirming}>
      <TooltipTrigger>
        <Button
          size="S"
          variant="quiet"
          aria-label={label}
          leadingVisual={<Icon svg={<Icons.Trash />} />}
        />
        <Tooltip offset={1}>{label}</Tooltip>
      </TooltipTrigger>
      <ModalOverlay>
        <Modal size="S">
          <Dialog>
            {({ close }) => (
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{`Delete ${noun}`}</DialogTitle>
                </DialogHeader>
                <View padding="size-200">
                  <Text>
                    {`This will delete ${target}, and it cannot be undone.`}
                  </Text>
                </View>
                <DialogFooter>
                  <Button size="S" onPress={close}>
                    Cancel
                  </Button>
                  <Button size="S" variant="danger" onPress={handleDelete}>
                    {`Delete ${noun}`}
                  </Button>
                </DialogFooter>
              </DialogContent>
            )}
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
