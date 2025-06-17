import { Suspense, useState } from "react";
import {
  graphql,
  PreloadedQuery,
  useMutation,
  usePreloadedQuery,
  useQueryLoader,
} from "react-relay";

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
  Loading,
  Modal,
  ModalOverlay,
} from "@phoenix/components";
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
        providerKey
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
              costs: Object.entries(params.cost)
                .filter(([_, value]) => value != null)
                .map(([key, value]) => ({
                  tokenType: key,
                  costPerToken: value,
                })),
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
      <ModalOverlay>
        <Modal>
          <Dialog>
            <DialogContent>
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
            </DialogContent>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
