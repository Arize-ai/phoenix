import { useState } from "react";

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
import { useNotifySuccess } from "@phoenix/contexts";

import { ModelForm, ModelFormParams } from "./ModelForm";

export function NewModelButton({
  onModelCreated,
}: {
  onModelCreated?: (model: ModelFormParams) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const notifySuccess = useNotifySuccess();

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
      >
        Add Model
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
                    onModelCreated && onModelCreated(params);
                    notifySuccess({
                      title: `Model Created`,
                      message: `Model "${params.name}" created successfully`,
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
