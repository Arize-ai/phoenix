import { startTransition, useState } from "react";
import { graphql, useMutation } from "react-relay";

import {
  Alert,
  Button,
  Dialog,
  Flex,
  Modal,
  ModalOverlay,
  Text,
  View,
} from "@phoenix/components";
import { Checkbox } from "@phoenix/components/core/checkbox";
import {
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/core/dialog";
import { useNotifySuccess } from "@phoenix/contexts";
import type { DeleteProjectEvaluatorDialogMutation } from "@phoenix/pages/project/evaluators/__generated__/DeleteProjectEvaluatorDialogMutation.graphql";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

export function DeleteProjectEvaluatorDialog({
  projectEvaluatorId,
  evaluatorName,
  evaluatorKind,
  updateConnectionIds,
  isOpen,
  onOpenChange,
}: {
  projectEvaluatorId: string;
  evaluatorName: string;
  evaluatorKind: "LLM" | "CODE" | "BUILTIN";
  updateConnectionIds: string[];
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}) {
  const notifySuccess = useNotifySuccess();
  const [deleteAssociatedPrompt, setDeleteAssociatedPrompt] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commitDelete, isDeleting] =
    useMutation<DeleteProjectEvaluatorDialogMutation>(graphql`
      mutation DeleteProjectEvaluatorDialogMutation(
        $input: DeleteProjectEvaluatorsInput!
        $connectionIds: [ID!]!
      ) {
        deleteProjectEvaluators(input: $input) {
          projectEvaluatorIds @deleteEdge(connections: $connectionIds)
        }
      }
    `);

  const handleOpenChange = (nextIsOpen: boolean) => {
    if (nextIsOpen) setError(null);
    onOpenChange(nextIsOpen);
  };
  return (
    <ModalOverlay isOpen={isOpen} onOpenChange={handleOpenChange}>
      <Modal size="S">
        <Dialog>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete evaluator</DialogTitle>
              <DialogTitleExtra>
                <DialogCloseButton />
              </DialogTitleExtra>
            </DialogHeader>
            {error ? (
              <View paddingX="size-200" paddingTop="size-100">
                <Alert variant="danger" banner>
                  {error}
                </Alert>
              </View>
            ) : null}
            <View padding="size-200">
              <Flex direction="column" gap="size-100">
                <Text>
                  Evaluator “{evaluatorName}” will be permanently deleted.
                </Text>
                {evaluatorKind === "LLM" ? (
                  <Checkbox
                    isSelected={deleteAssociatedPrompt}
                    onChange={setDeleteAssociatedPrompt}
                  >
                    Delete associated prompt
                  </Checkbox>
                ) : null}
              </Flex>
            </View>
            <View
              padding="size-100"
              borderTopColor="default"
              borderTopWidth="thin"
            >
              <Flex direction="row" justifyContent="end" gap="size-100">
                <Button onPress={() => handleOpenChange(false)}>Cancel</Button>
                <Button
                  variant="danger"
                  isDisabled={isDeleting}
                  onPress={() => {
                    setError(null);
                    startTransition(() => {
                      commitDelete({
                        variables: {
                          input: {
                            projectEvaluatorIds: [projectEvaluatorId],
                            deleteAssociatedPrompt:
                              evaluatorKind === "LLM" && deleteAssociatedPrompt,
                          },
                          connectionIds: updateConnectionIds,
                        },
                        onCompleted: () => {
                          notifySuccess({ title: "Evaluator deleted" });
                          onOpenChange(false);
                        },
                        onError: (mutationError) =>
                          setError(
                            getErrorMessagesFromRelayMutationError(
                              mutationError
                            )?.join("\n") ?? mutationError.message
                          ),
                      });
                    });
                  }}
                >
                  Delete evaluator
                </Button>
              </Flex>
            </View>
          </DialogContent>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
