import { css } from "@emotion/react";
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
import { CopyButton } from "@phoenix/components/core/copy";
import { ExperimentCompareDetails } from "@phoenix/components/experiment/ExperimentCompareDetails";
import { ExampleDetailsPaginator } from "@phoenix/pages/experiment/ExampleDetailsPaginator";

const dialogTitleIdCSS = css`
  display: inline-flex;
  align-items: center;
  gap: var(--global-dimension-static-size-50);

  .copy-button {
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.15s ease-in-out;
  }

  &:hover .copy-button,
  .copy-button:focus-within {
    opacity: 1;
    pointer-events: auto;
  }
`;

const monoCSS = css`
  font-family: "Geist Mono", monospace;
  white-space: nowrap;
`;

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
            <DialogTitle>
              <span css={dialogTitleIdCSS}>
                Example: <span css={monoCSS}>{selectedExampleId}</span>
                <CopyButton text={selectedExampleId} variant="quiet" size="S" />
              </span>
            </DialogTitle>
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
