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

import { EditModelButtonMutation } from "./__generated__/EditModelButtonMutation.graphql";
import { EditModelButtonQuery } from "./__generated__/EditModelButtonQuery.graphql";
import { ModelForm, ModelFormParams } from "./ModelForm";

const ModelQuery = graphql`
  query EditModelButtonQuery($id: ID!) {
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

function EditModelDialogContent({
  queryReference,
  onModelEdited,
  onClose,
}: {
  queryReference: PreloadedQuery<EditModelButtonQuery>;
  onModelEdited?: (model: ModelFormParams) => void;
  onClose: () => void;
}) {
  const data = usePreloadedQuery<EditModelButtonQuery>(
    ModelQuery,
    queryReference
  );
  const [commitUpdateModel, isCommittingUpdateModel] =
    useMutation<EditModelButtonMutation>(graphql`
      mutation EditModelButtonMutation($input: UpdateModelMutationInput!) {
        updateModel(input: $input) {
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
      modelName={modelData.name}
      modelProvider={modelData.provider}
      modelNamePattern={modelData.namePattern}
      modelCost={modelData.tokenCost}
      onSubmit={(params) => {
        commitUpdateModel({
          variables: {
            input: {
              id: modelData.id!,
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
            onModelEdited && onModelEdited(params);
            notifySuccess({
              title: `Model Updated`,
              message: `Model "${params.name}" updated successfully`,
            });
          },
          onError: (error) => {
            const formattedError =
              getErrorMessagesFromRelayMutationError(error);
            notifyError({
              title: "Failed to update model",
              message: formattedError?.[0] ?? "Failed to update model",
            });
          },
        });
      }}
      isSubmitting={isCommittingUpdateModel}
      submitButtonText="Save Changes"
      formMode="edit"
    />
  );
}

export function EditModelButton({
  modelId,
  onModelEdited,
}: {
  modelId: string;
  onModelEdited?: (model: ModelFormParams) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [queryReference, loadQuery, disposeQuery] =
    useQueryLoader<EditModelButtonQuery>(ModelQuery);

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
        leadingVisual={<Icon svg={<Icons.EditOutline />} />}
        aria-label="Edit model"
        onPress={handleOpen}
        size="S"
      >
        Edit
      </Button>
      <DialogContainer onDismiss={handleClose}>
        {isOpen && (
          <ModalOverlay>
            <Modal>
              <Dialog>
                <DialogHeader>
                  <DialogTitle>Edit Model</DialogTitle>
                  <DialogTitleExtra>
                    <DialogCloseButton slot="close" />
                  </DialogTitleExtra>
                </DialogHeader>
                <Suspense fallback={<Loading />}>
                  {queryReference ? (
                    <EditModelDialogContent
                      queryReference={queryReference}
                      onModelEdited={onModelEdited}
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
