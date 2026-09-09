import { Suspense } from "react";

import {
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitleExtra,
  Flex,
  Heading,
  LinkButton,
} from "@phoenix/components";
import { ExperimentCompareDetails } from "@phoenix/components/experiment/ExperimentCompareDetails";
import { ExampleDetailsLink } from "@phoenix/pages/example/ExampleDetailsLink";
import { ExampleDetailsPaginator } from "@phoenix/pages/experiment/ExampleDetailsPaginator";

export function ExperimentCompareDetailsDialog({
  selectedExampleId,
  selectedExampleExternalId,
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
  selectedExampleExternalId?: string | null;
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
          <Flex gap="size-150" alignItems="center">
            <ExampleDetailsPaginator
              currentExampleIndex={selectedExampleIndex}
              exampleIds={exampleIds}
              onExampleChange={onExampleChange}
            />
            <Heading>Example</Heading>
            <ExampleDetailsLink
              exampleId={selectedExampleId}
              externalId={selectedExampleExternalId}
              datasetVersionId={datasetVersionId}
            />
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
