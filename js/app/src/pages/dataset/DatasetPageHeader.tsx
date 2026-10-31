import { useState } from "react";

import type { PageHeaderLabel } from "@phoenix/components";
import { Button, Flex, Icon, Icons, PageHeader } from "@phoenix/components";
import { DatasetLabelConfigButton } from "@phoenix/components/dataset";
import { useNotifySuccess } from "@phoenix/contexts";
import { EditDatasetDialog } from "@phoenix/pages/datasets/EditDatasetDialog";

import { DatasetDownloadMenu } from "./DatasetDownloadMenu";
import { RunDatasetExperimentButton } from "./RunDatasetExperimentButton";

type DatasetPageHeaderDataset = {
  id: string;
  name?: string;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
  labels?: readonly PageHeaderLabel[];
};

export function DatasetPageHeader({
  dataset,
}: {
  dataset: DatasetPageHeaderDataset;
}) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const notifySuccess = useNotifySuccess();
  return (
    <>
      <PageHeader
        title={dataset.name}
        labels={dataset.labels}
        labelAction={<DatasetLabelConfigButton datasetId={dataset.id} />}
        subTitle={dataset.description}
        extra={
          <Flex direction="row" gap="size-100" alignItems="center">
            <Button
              size="M"
              leadingVisual={<Icon svg={<Icons.Edit />} />}
              aria-label="Edit dataset"
              onPress={() => setIsEditOpen(true)}
            />
            <DatasetDownloadMenu datasetId={dataset.id} />
            <RunDatasetExperimentButton variant="primary" size="M" />
          </Flex>
        }
      />
      <EditDatasetDialog
        datasetId={dataset.id}
        datasetName={dataset.name ?? ""}
        datasetDescription={dataset.description}
        datasetMetadata={dataset.metadata}
        onDatasetEdited={() =>
          notifySuccess({
            title: "Dataset updated",
            message: "The dataset has been updated.",
          })
        }
        isOpen={isEditOpen}
        onOpenChange={setIsEditOpen}
      />
    </>
  );
}
