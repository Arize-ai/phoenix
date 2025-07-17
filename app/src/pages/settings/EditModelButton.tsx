import { Suspense, useState } from "react";
import {
  graphql,
  PreloadedQuery,
  useMutation,
  usePreloadedQuery,
  useQueryLoader,
} from "react-relay";
import { useRevalidator } from "react-router";
import { getLocalTimeZone } from "@internationalized/date";

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
import { Mutable } from "@phoenix/typeUtils";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import { EditModelButtonMutation } from "./__generated__/EditModelButtonMutation.graphql";
import { EditModelButtonQuery } from "./__generated__/EditModelButtonQuery.graphql";
import { ModelForm, ModelFormParams } from "./ModelForm";

const ModelQuery = graphql`
  query EditModelButtonQuery($id: ID!) {
    node(id: $id) {
      ... on GenerativeModel {
        id
        name
        provider
        namePattern
        providerKey
        startTime
        tokenPrices {
          tokenType
          kind
          costPerMillionTokens
          costPerToken
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
  const { revalidate } = useRevalidator();
  const data = usePreloadedQuery<EditModelButtonQuery>(
    ModelQuery,
    queryReference
  );
  const [commitUpdateModel, isCommittingUpdateModel] =
    useMutation<EditModelButtonMutation>(graphql`
      mutation EditModelButtonMutation($input: UpdateModelMutationInput!) {
        updateModel(input: $input) {
          model {
            id
            name
            provider
            namePattern
            providerKey
            startTime
            tokenPrices {
              tokenType
              kind
              costPerMillionTokens
              costPerToken
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
      modelName={modelData.name}
      modelProvider={modelData.provider}
      modelNamePattern={modelData.namePattern}
      modelCost={modelData.tokenPrices as Mutable<typeof modelData.tokenPrices>}
      startDate={modelData.startTime}
      onSubmit={(params) => {
        commitUpdateModel({
          variables: {
            input: {
              id: modelData.id!,
              name: params.name,
              provider: params.provider,
              namePattern: params.namePattern,
              startTime: params.startTime
                ? params.startTime.toDate(getLocalTimeZone()).toISOString()
                : null,
              costs: [...params.promptCosts, ...params.completionCosts].map(
                (cost) => ({
                  tokenType: cost.tokenType,
                  costPerMillionTokens: cost.costPerMillionTokens,
                  kind: cost.kind,
                })
              ),
            },
          },
          onCompleted: () => {
            onClose();
            onModelEdited && onModelEdited(params);
            notifySuccess({
              title: `Model Updated`,
              message: `Model "${params.name}" updated successfully`,
            });
            revalidate();
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
      />
      <ModalOverlay>
        <Modal>
          <Dialog>
            <DialogContent>
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
            </DialogContent>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
