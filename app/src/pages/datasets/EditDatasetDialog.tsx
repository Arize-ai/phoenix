import { Dialog } from "@phoenix/components";
import { EditDatasetForm } from "@phoenix/components/dataset";
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@phoenix/components/dialog";

export function EditDatasetDialog({
  datasetName,
  datasetId,
  datasetDescription,
  datasetMetadata,
  onDatasetEdited,
  onDatasetEditError,
}: {
  datasetName: string;
  datasetId: string;
  datasetDescription?: string | null;
  datasetMetadata?: Record<string, unknown> | null;
  onDatasetEdited: () => void;
  onDatasetEditError: (error: Error) => void;
}) {
  return (
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
          onDatasetEdited={onDatasetEdited}
          onDatasetEditError={onDatasetEditError}
        />
      </DialogContent>
    </Dialog>
  );
}
