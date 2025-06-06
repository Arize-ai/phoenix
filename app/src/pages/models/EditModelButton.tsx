import { Suspense, useState } from "react";
import {
  graphql,
  PreloadedQuery,
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
import { useNotifySuccess } from "@phoenix/contexts";

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
  const notifySuccess = useNotifySuccess();
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
        onClose();
        onModelEdited && onModelEdited(params);
        notifySuccess({
          title: `Model Updated`,
          message: `Model "${params.name}" updated successfully`,
        });
      }}
      isSubmitting={false}
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
