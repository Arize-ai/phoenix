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
  datasetId,
  datasetVersionId,
  baseExperimentId,
  compareExperimentIds,
  exampleIds,
  onNextExample,
  onPreviousExample,
}: {
  selectedExampleId: string;
  datasetId: string;
  datasetVersionId: string;
  baseExperimentId: string;
  compareExperimentIds: string[];
  exampleIds?: string[];
  onNextExample?: (nextId: string) => void;
  onPreviousExample?: (previousId: string) => void;
}) {
  return (
    <Dialog aria-label="Example Details">
      <DialogContent>
        <DialogHeader>
          <Flex gap="size-150">
            {onNextExample && onPreviousExample && exampleIds && (
              <ExampleDetailsPaginator
                currentId={selectedExampleId}
                exampleIds={exampleIds}
                onNext={onNextExample}
                onPrevious={onPreviousExample}
              />
            )}
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
          />
        </Suspense>
      </DialogContent>
    </Dialog>
  );
}
