import {
  Dialog,
  ViewportModal,
  ViewportModalOverlay,
} from "@phoenix/components";
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@phoenix/components/core/dialog";
import { EditDatasetForm } from "@phoenix/components/dataset";

export type EditDatasetDialogProps = {
  datasetName: string;
  datasetId: string;
  datasetDescription?: string | null;
  datasetMetadata?: Record<string, unknown> | null;
  onDatasetEdited: () => void;
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
};

export function EditDatasetDialog({
  datasetName,
  datasetId,
  datasetDescription,
  datasetMetadata,
  onDatasetEdited,
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
    <ViewportModalOverlay isOpen={isOpen} onOpenChange={onOpenChange}>
      <ViewportModal size="S">
        <Dialog>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Dataset</DialogTitle>
            </DialogHeader>
            <EditDatasetForm
              datasetName={datasetName}
              datasetId={datasetId}
              datasetDescription={datasetDescription}
              datasetMetadata={datasetMetadata}
              onDatasetEdited={handleSuccess}
              onCancel={() => onOpenChange?.(false)}
            />
          </DialogContent>
        </Dialog>
      </ViewportModal>
    </ViewportModalOverlay>
  );
}
