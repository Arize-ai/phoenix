import { Dialog } from "@arizeai/components";

import { EditDatasetForm } from "@phoenix/components/dataset";

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
    <Dialog title={"Edit Dataset"} size="M">
      <EditDatasetForm
        datasetName={datasetName}
        datasetId={datasetId}
        datasetDescription={datasetDescription}
        datasetMetadata={datasetMetadata}
        onDatasetEdited={onDatasetEdited}
        onDatasetEditError={onDatasetEditError}
      />
    </Dialog>
  );
}
