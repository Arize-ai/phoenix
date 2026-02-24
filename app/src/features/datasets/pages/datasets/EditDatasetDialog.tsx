import { Dialog, Modal, ModalOverlay } from "@phoenix/components";
import {
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/dialog";
import { EditDatasetForm } from "@phoenix/features/datasets/components/dataset";

export type EditDatasetDialogProps = {
  datasetName: string;
  datasetId: string;
  datasetDescription?: string | null;
  datasetMetadata?: Record<string, unknown> | null;
  onDatasetEdited: () => void;
  onDatasetEditError: (error: Error) => void;
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
};

export function EditDatasetDialog({
  datasetName,
  datasetId,
  datasetDescription,
  datasetMetadata,
  onDatasetEdited,
  onDatasetEditError,
  isOpen,
  onOpenChange,
}: EditDatasetDialogProps) {
  const handleSuccess = () => {
    onDatasetEdited();
    if (onOpenChange) {
      onOpenChange(false);
    }
  };

  return (
    <ModalOverlay isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal size="S">
        <Dialog>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Dataset</DialogTitle>
              <DialogTitleExtra>
                <DialogCloseButton />
              </DialogTitleExtra>
            </DialogHeader>
            <EditDatasetForm
              datasetName={datasetName}
              datasetId={datasetId}
              datasetDescription={datasetDescription}
              datasetMetadata={datasetMetadata}
              onDatasetEdited={handleSuccess}
              onDatasetEditError={onDatasetEditError}
            />
          </DialogContent>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
