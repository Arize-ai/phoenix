import { Suspense } from "react";

import {
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
  Flex,
  LinkButton,
} from "@phoenix/components";
import { ExperimentCompareDetails } from "@phoenix/components/experiment/ExperimentCompareDetails";
import { ExampleDetailsPaginator } from "@phoenix/pages/experiment/ExampleDetailsPaginator";

export function ExperimentCompareDetailsDialog({
  selectedExampleId,
  selectedExampleIndex,
  datasetId,
  datasetVersionId,
  baseExperimentId,
  compareExperimentIds,
  exampleIds,
  onExampleChange,
  repetitionNumber,
  openTraceDialog,
}: {
  selectedExampleId: string;
  selectedExampleIndex: number;
  datasetId: string;
  datasetVersionId: string;
  baseExperimentId: string;
  compareExperimentIds: string[];
  exampleIds: string[];
  onExampleChange: (exampleIndex: number) => void;
  repetitionNumber?: number;
  openTraceDialog: (traceId: string, projectId: string, title: string) => void;
}) {
  return (
    <Dialog aria-label="Example Details">
      <DialogContent>
        <DialogHeader>
          <Flex gap="size-150">
            <ExampleDetailsPaginator
              currentExampleIndex={selectedExampleIndex}
              exampleIds={exampleIds}
              onExampleChange={onExampleChange}
            />
            <DialogTitle>{`Example: ${selectedExampleId}`}</DialogTitle>
          </Flex>
          <DialogTitleExtra>
            <LinkButton
              size="S"
              to={`/datasets/${datasetId}/examples/${selectedExampleId}`}
            >
              View Example
            </LinkButton>
            <DialogCloseButton />
          </DialogTitleExtra>
        </DialogHeader>
        <Suspense>
          <ExperimentCompareDetails
            datasetId={datasetId}
            datasetExampleId={selectedExampleId}
            datasetVersionId={datasetVersionId}
            baseExperimentId={baseExperimentId}
            compareExperimentIds={compareExperimentIds}
            defaultSelectedRepetitionNumber={repetitionNumber}
            openTraceDialog={openTraceDialog}
            key={repetitionNumber} // reset selection state when repetition number changes
          />
        </Suspense>
      </DialogContent>
    </Dialog>
  );
}
