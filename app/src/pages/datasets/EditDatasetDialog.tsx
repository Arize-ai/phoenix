import React from "react";

import { Dialog } from "@arizeai/components";

import { EditDatasetForm } from "@phoenix/components/dataset";

export function EditDatasetDialog({
  datasetName,
  datasetId,
  datasetDescription,
  onDatasetEdited,
  onDatasetEditError,
}: {
  datasetName: string;
  datasetId: string;
  datasetDescription?: string | null;
  onDatasetEdited: () => void;
  onDatasetEditError: (error: Error) => void;
}) {
  return (
    <Dialog title={"Edit Dataset"} size="M">
      <EditDatasetForm
        datasetName={datasetName}
        datasetId={datasetId}
        datasetDescription={datasetDescription}
        onDatasetEdited={onDatasetEdited}
        onDatasetEditError={onDatasetEditError}
      />
    </Dialog>
  );
}
