import { useState } from "react";
import { graphql, useMutation } from "react-relay";

import { DialogContainer } from "@arizeai/components";

import {
  Alert,
  Button,
  DialogTrigger,
  Icon,
  Icons,
  Modal,
  ModalOverlay,
} from "@phoenix/components";
import {
  Dialog,
  DialogCloseButton,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/dialog/Dialog";
import { useNotifyError, useNotifySuccess } from "@phoenix/contexts";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import type { NewModelButtonCreateModelMutation } from "./__generated__/NewModelButtonCreateModelMutation.graphql";
import { ModelForm, ModelFormParams } from "./ModelForm";

export function NewModelButton({
  onModelCreated,
}: {
  onModelCreated?: (model: ModelFormParams) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const notifySuccess = useNotifySuccess();
  const notifyError = useNotifyError();

  const [commit, isCommitting] = useMutation<NewModelButtonCreateModelMutation>(
    graphql`
      mutation NewModelButtonCreateModelMutation(
        $input: CreateModelMutationInput!
      ) {
        createModel(input: $input) {
          model {
            id
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
      <DialogContainer onDismiss={() => setIsOpen(false)}>
        {isOpen && (
          <ModalOverlay>
            <Modal>
              <Dialog>
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
                    commit({
                      variables: {
                        input: {
                          name: params.name,
                          provider: params.provider || null,
                          namePattern: params.namePattern,
                          inputCostPerToken: params.cost.input,
                          outputCostPerToken: params.cost.output,
                          cacheReadCostPerToken: params.cost.cacheRead,
                          cacheWriteCostPerToken: params.cost.cacheWrite,
                          promptAudioCostPerToken: params.cost.promptAudio,
                        },
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
              </Dialog>
            </Modal>
          </ModalOverlay>
        )}
      </DialogContainer>
    </DialogTrigger>
  );
}
