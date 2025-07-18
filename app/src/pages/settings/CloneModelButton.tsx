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

import { CloneModelButtonMutation } from "./__generated__/CloneModelButtonMutation.graphql";
import type { CloneModelButtonQuery } from "./__generated__/CloneModelButtonQuery.graphql";
import { ModelForm, ModelFormParams } from "./ModelForm";

const ModelQuery = graphql`
  query CloneModelButtonQuery($id: ID!) {
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
  const { revalidate } = useRevalidator();
  const data = usePreloadedQuery<CloneModelButtonQuery>(
    ModelQuery,
    queryReference
  );
  const [commitCloneModel, isCommittingCloneModel] =
    useMutation<CloneModelButtonMutation>(graphql`
      mutation CloneModelButtonMutation($input: CreateModelMutationInput!) {
        createModel(input: $input) {
          query {
            ...ModelsTable_generativeModels
          }
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
      modelCost={modelData.tokenPrices as Mutable<typeof modelData.tokenPrices>}
      startDate={modelData.startTime}
      onSubmit={(params) => {
        commitCloneModel({
          variables: {
            input: {
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
            onModelCloned && onModelCloned(params);
            notifySuccess({
              title: `Model Cloned`,
              message: `Model "${params.name}" cloned successfully`,
            });
            revalidate();
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
      />
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
