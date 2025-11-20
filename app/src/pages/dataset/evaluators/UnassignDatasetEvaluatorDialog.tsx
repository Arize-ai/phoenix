import { startTransition, useCallback, useState } from "react";
import { useMutation } from "react-relay";
import { ConnectionHandler, graphql } from "relay-runtime";
import { css } from "@emotion/react";

import {
  Button,
  Checkbox,
  Dialog,
  Flex,
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
import type { UnassignDatasetEvaluatorDialogDeleteMutation } from "@phoenix/pages/dataset/evaluators/__generated__/UnassignDatasetEvaluatorDialogDeleteMutation.graphql";
import type { UnassignDatasetEvaluatorDialogUnassignMutation } from "@phoenix/pages/dataset/evaluators/__generated__/UnassignDatasetEvaluatorDialogUnassignMutation.graphql";
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
  const [deleteFromGlobalEvaluators, setDeleteFromGlobalEvaluators] =
    useState(false);
  const datasetEvaluatorsTableConnection = ConnectionHandler.getConnectionID(
    datasetId,
    "DatasetEvaluatorsTable_evaluators"
  );
  const [unassignEvaluatorFromDataset, isUnassigningEvaluatorFromDataset] =
    useMutation<UnassignDatasetEvaluatorDialogUnassignMutation>(graphql`
      mutation UnassignDatasetEvaluatorDialogUnassignMutation(
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

  const [deleteEvaluators, isDeletingEvaluators] =
    useMutation<UnassignDatasetEvaluatorDialogDeleteMutation>(graphql`
      mutation UnassignDatasetEvaluatorDialogDeleteMutation(
        $input: DeleteEvaluatorsInput!
        $datasetId: ID!
        $connectionIds: [ID!]!
      ) {
        deleteEvaluators(input: $input) {
          query {
            dataset: node(id: $datasetId) {
              ...PlaygroundDatasetSection_evaluators
                @arguments(datasetId: $datasetId)
              ...DatasetEvaluatorsTable_evaluators
                @arguments(datasetId: $datasetId)
            }
          }
          evaluatorIds @deleteEdge(connections: $connectionIds)
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
            title: "Evaluator unlinked",
            message: "The evaluator has been unlinked from the dataset.",
          });
        },
        onError: (error) => {
          notifyError({
            title: "Failed to unlink evaluator from dataset",
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

  const handleDeleteEvaluator = useCallback(() => {
    startTransition(() => {
      deleteEvaluators({
        variables: {
          input: {
            evaluatorIds: [evaluatorId],
          },
          connectionIds: [datasetEvaluatorsTableConnection],
          datasetId,
        },
        onCompleted: () => {
          notifySuccess({
            title: "Evaluator deleted",
            message: "The evaluator has been deleted.",
          });
        },
        onError: (error) => {
          notifyError({
            title: "Failed to delete evaluator",
            message:
              getErrorMessagesFromRelayMutationError(error)?.join("\n") ??
              error.message,
          });
        },
      });
    });
  }, [
    deleteEvaluators,
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
              <DialogTitle>Unlink evaluator</DialogTitle>
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
                Are you sure you want to unlink evaluator <b>{evaluatorName}</b>{" "}
                from this dataset?
              </Text>
              <Checkbox
                isSelected={deleteFromGlobalEvaluators}
                onChange={setDeleteFromGlobalEvaluators}
              >
                <Text>
                  Delete <b>{evaluatorName}</b> evaluator. It will be removed
                  from all datasets that use it.
                </Text>
              </Checkbox>
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
                  onPress={
                    deleteFromGlobalEvaluators
                      ? handleDeleteEvaluator
                      : handleUnassignEvaluator
                  }
                  isDisabled={
                    isUnassigningEvaluatorFromDataset || isDeletingEvaluators
                  }
                >
                  {deleteFromGlobalEvaluators ? "Delete" : "Unlink"} evaluator
                </Button>
              </Flex>
            </View>
          </DialogContent>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
