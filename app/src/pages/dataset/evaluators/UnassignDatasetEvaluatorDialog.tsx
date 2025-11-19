import { startTransition, useCallback } from "react";
import { useMutation } from "react-relay";
import { ConnectionHandler, graphql } from "relay-runtime";
import { css } from "@emotion/react";

import {
  Button,
  Dialog,
  Flex,
  Icon,
  Icons,
  Modal,
  ModalOverlay,
  Text,
  View,
} from "@phoenix/components";
import {
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/dialog";
import { useNotifyError, useNotifySuccess } from "@phoenix/contexts";
import type { UnassignDatasetEvaluatorDialogMutation } from "@phoenix/pages/dataset/evaluators/__generated__/UnassignDatasetEvaluatorDialogMutation.graphql";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

export type UnassignDatasetEvaluatorDialogProps = {
  evaluatorId: string;
  evaluatorName: string;
  datasetId: string;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
};

export function UnassignDatasetEvaluatorDialog({
  evaluatorId,
  evaluatorName,
  datasetId,
  isOpen,
  onOpenChange,
}: UnassignDatasetEvaluatorDialogProps) {
  const datasetEvaluatorsTableConnection = ConnectionHandler.getConnectionID(
    datasetId,
    "DatasetEvaluatorsTable_evaluators"
  );
  const [unassignEvaluatorFromDataset, isUnassigningEvaluatorFromDataset] =
    useMutation<UnassignDatasetEvaluatorDialogMutation>(graphql`
      mutation UnassignDatasetEvaluatorDialogMutation(
        $input: UnassignEvaluatorFromDatasetInput!
        $datasetId: ID!
        $connectionIds: [ID!]!
      ) {
        unassignEvaluatorFromDataset(input: $input) {
          query {
            dataset: node(id: $datasetId) {
              ...PlaygroundDatasetSection_evaluators
                @arguments(datasetId: $datasetId)
              ...DatasetEvaluatorsTable_evaluators
                @arguments(datasetId: $datasetId)
            }
          }
          evaluator @deleteEdge(connections: $connectionIds) {
            ...EvaluatorsTable_row @arguments(datasetId: $datasetId)
          }
        }
      }
    `);
  const notifySuccess = useNotifySuccess();
  const notifyError = useNotifyError();

  const handleUnassignEvaluator = useCallback(() => {
    startTransition(() => {
      unassignEvaluatorFromDataset({
        variables: {
          input: {
            datasetId,
            evaluatorId,
          },
          connectionIds: [datasetEvaluatorsTableConnection],
          datasetId,
        },
        onCompleted: () => {
          notifySuccess({
            title: "Evaluator removed",
            message: "The evaluator has been removed from the dataset.",
          });
        },
        onError: (error) => {
          notifyError({
            title: "Failed to remove evaluator from dataset",
            message:
              getErrorMessagesFromRelayMutationError(error)?.join("\n") ??
              error.message,
          });
        },
      });
    });
  }, [
    unassignEvaluatorFromDataset,
    datasetId,
    evaluatorId,
    datasetEvaluatorsTableConnection,
    notifySuccess,
    notifyError,
  ]);

  return (
    <ModalOverlay isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal size="S">
        <Dialog>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Remove evaluator link</DialogTitle>
              <DialogTitleExtra>
                <DialogCloseButton />
              </DialogTitleExtra>
            </DialogHeader>
            <Flex
              direction="column"
              gap="size-100"
              css={css`
                padding: var(--ac-global-dimension-size-200);
              `}
            >
              <Text>
                {`Are you sure you want to unlink evaluator ${evaluatorName} from this dataset?`}
              </Text>
              <Text>
                This will unlink the evaluator from the dataset. It will still
                be available in the global Evaluators section, and this
                won&apos;t impact other datasets that use it.
              </Text>
            </Flex>
            <View
              paddingEnd="size-200"
              paddingTop="size-100"
              paddingBottom="size-100"
              borderTopColor="light"
              borderTopWidth="thin"
            >
              <Flex direction="row" justifyContent="end" gap="size-100">
                <Button
                  size="S"
                  variant="quiet"
                  onPress={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  size="S"
                  onPress={() => {
                    handleUnassignEvaluator();
                  }}
                  isDisabled={isUnassigningEvaluatorFromDataset}
                  leadingVisual={
                    <Icon
                      svg={
                        isUnassigningEvaluatorFromDataset ? (
                          <Icons.LoadingOutline />
                        ) : (
                          <Icons.TrashOutline />
                        )
                      }
                    />
                  }
                >
                  Remove evaluator
                </Button>
              </Flex>
            </View>
          </DialogContent>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
