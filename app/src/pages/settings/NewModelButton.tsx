import { useState } from "react";
import { ConnectionHandler, graphql, useMutation } from "react-relay";

import {
  Alert,
  Button,
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
  DialogTrigger,
  Icon,
  Icons,
  Modal,
  ModalOverlay,
} from "@phoenix/components";
import { useNotifyError, useNotifySuccess } from "@phoenix/contexts";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import type { NewModelButtonCreateModelMutation } from "./__generated__/NewModelButtonCreateModelMutation.graphql";
import { ModelForm, ModelFormParams } from "./ModelForm";

export function NewModelButton({
  onModelCreated,
  queryId,
}: {
  onModelCreated?: (model: ModelFormParams) => void;
  queryId: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const notifySuccess = useNotifySuccess();
  const notifyError = useNotifyError();

  const [commit, isCommitting] = useMutation<NewModelButtonCreateModelMutation>(
    graphql`
      mutation NewModelButtonCreateModelMutation(
        $input: CreateModelMutationInput!
        $connectionId: ID!
      ) {
        createModel(input: $input) {
          model
            @prependNode(
              connections: [$connectionId]
              edgeTypeName: "GenerativeModelEdge"
            ) {
            ...ModelsTable_generativeModel
          }
        }
      }
    `
  );

  return (
    <DialogTrigger
      isOpen={isOpen}
      onOpenChange={(isOpen) => {
        setError(null);
        setIsOpen(isOpen);
      }}
    >
      <Button
        variant="primary"
        size="S"
        leadingVisual={<Icon svg={<Icons.PlusCircleOutline />} />}
        aria-label="Create a new model"
        onPress={() => {
          setError(null);
          setIsOpen(true);
        }}
        isDisabled={isCommitting}
      >
        {isCommitting ? "Adding Model..." : "Add Model"}
      </Button>
      <ModalOverlay>
        <Modal>
          <Dialog>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Model</DialogTitle>
                <DialogTitleExtra>
                  <DialogCloseButton slot="close" />
                </DialogTitleExtra>
              </DialogHeader>
              {error ? <Alert variant="danger">{error}</Alert> : null}
              <ModelForm
                onSubmit={(params) => {
                  setError(null);
                  setIsOpen(false);
                  const connectionId = ConnectionHandler.getConnectionID(
                    queryId,
                    "ModelsTable_generativeModels"
                  );
                  commit({
                    variables: {
                      input: {
                        name: params.name,
                        provider: params.provider,
                        namePattern: params.namePattern,
                        costs: [
                          ...params.promptCosts,
                          ...params.completionCosts,
                        ].map((cost) => ({
                          tokenType: cost.name,
                          costPerToken: cost.costPerMillion,
                        })),
                      },
                      connectionId,
                    },
                    onCompleted: () => {
                      onModelCreated && onModelCreated(params);
                      notifySuccess({
                        title: `Model Created`,
                        message: `Model "${params.name}" added successfully`,
                      });
                    },
                    onError: (error) => {
                      const formattedError =
                        getErrorMessagesFromRelayMutationError(error);
                      notifyError({
                        title: "An error occurred",
                        message: `Failed to add model: ${formattedError?.[0] ?? error.message}`,
                      });
                    },
                  });
                }}
                isSubmitting={false}
                submitButtonText="Create Model"
                formMode="create"
              />
            </DialogContent>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
