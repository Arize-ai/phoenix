import { Suspense, useState } from "react";
import {
  graphql,
  PreloadedQuery,
  useMutation,
  usePreloadedQuery,
  useQueryLoader,
} from "react-relay";

import { DialogContainer } from "@arizeai/components";

import {
  Alert,
  Button,
  DialogTrigger,
  Icon,
  Icons,
  Loading,
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

import { CloneModelButtonMutation } from "./__generated__/CloneModelButtonMutation.graphql";
import type { CloneModelButtonQuery } from "./__generated__/CloneModelButtonQuery.graphql";
import { ModelForm, ModelFormParams } from "./ModelForm";

const ModelQuery = graphql`
  query CloneModelButtonQuery($id: ID!) {
    node(id: $id) {
      ... on Model {
        id
        name
        provider
        namePattern
        tokenCost {
          input
          output
          cacheRead
          cacheWrite
          promptAudio
          completionAudio
        }
      }
    }
  }
`;

function CloneModelDialogContent({
  queryReference,
  onModelCloned,
  onClose,
}: {
  queryReference: PreloadedQuery<CloneModelButtonQuery>;
  onModelCloned?: (model: ModelFormParams) => void;
  onClose: () => void;
}) {
  const data = usePreloadedQuery<CloneModelButtonQuery>(
    ModelQuery,
    queryReference
  );
  const [commitCloneModel, isCommittingCloneModel] =
    useMutation<CloneModelButtonMutation>(graphql`
      mutation CloneModelButtonMutation($input: CreateModelMutationInput!) {
        createModel(input: $input) {
          model {
            id
            name
            provider
            namePattern
            providerKey
            tokenCost {
              input
              output
              cacheRead
              cacheWrite
              promptAudio
              completionAudio
              reasoning
            }
          }
          __typename
        }
      }
    `);
  const notifySuccess = useNotifySuccess();
  const notifyError = useNotifyError();
  const modelData = data?.node;

  if (!modelData) {
    return <Alert variant="danger">Model not found</Alert>;
  }

  return (
    <ModelForm
      modelName={`${modelData.name} (override)`}
      modelProvider={modelData.provider}
      modelNamePattern={modelData.namePattern}
      modelCost={modelData.tokenCost}
      onSubmit={(params) => {
        commitCloneModel({
          variables: {
            input: {
              name: params.name,
              provider: params.provider,
              namePattern: params.namePattern,
              inputCostPerToken: params.cost.input,
              outputCostPerToken: params.cost.output,
              cacheReadCostPerToken: params.cost.cacheRead,
              cacheWriteCostPerToken: params.cost.cacheWrite,
              promptAudioCostPerToken: params.cost.promptAudio,
              completionAudioCostPerToken: params.cost.completionAudio,
              reasoningCostPerToken: params.cost.reasoning,
            },
          },
          onCompleted: () => {
            onClose();
            onModelCloned && onModelCloned(params);
            notifySuccess({
              title: `Model Cloned`,
              message: `Model "${params.name}" cloned successfully`,
            });
          },
          onError: (error) => {
            const formattedError =
              getErrorMessagesFromRelayMutationError(error);
            notifyError({
              title: "Failed to clone model",
              message: formattedError?.[0] ?? "Failed to clone model",
            });
          },
        });
      }}
      isSubmitting={isCommittingCloneModel}
      submitButtonText="Save Changes"
      formMode="create"
    />
  );
}

export function CloneModelButton({
  modelId,
  onModelCloned,
}: {
  modelId: string;
  onModelCloned?: (model: ModelFormParams) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [queryReference, loadQuery, disposeQuery] =
    useQueryLoader<CloneModelButtonQuery>(ModelQuery);

  const handleOpen = () => {
    loadQuery({ id: modelId }, { fetchPolicy: "network-only" });
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
    disposeQuery();
  };

  return (
    <DialogTrigger
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <Button
        variant="default"
        leadingVisual={<Icon svg={<Icons.DuplicateIcon />} />}
        aria-label="Clone model"
        onPress={handleOpen}
        size="S"
      >
        Clone
      </Button>
      <DialogContainer onDismiss={handleClose}>
        {isOpen && (
          <ModalOverlay>
            <Modal>
              <Dialog>
                <DialogHeader>
                  <DialogTitle>Clone Model</DialogTitle>
                  <DialogTitleExtra>
                    <DialogCloseButton slot="close" />
                  </DialogTitleExtra>
                </DialogHeader>
                <Suspense fallback={<Loading />}>
                  {queryReference ? (
                    <CloneModelDialogContent
                      queryReference={queryReference}
                      onModelCloned={onModelCloned}
                      onClose={handleClose}
                    />
                  ) : (
                    <Loading />
                  )}
                </Suspense>
              </Dialog>
            </Modal>
          </ModalOverlay>
        )}
      </DialogContainer>
    </DialogTrigger>
  );
}
