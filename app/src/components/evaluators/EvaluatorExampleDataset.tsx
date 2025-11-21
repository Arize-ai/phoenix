import { useState } from "react";
import { css } from "@emotion/react";

import { Flex, Heading, Text } from "@phoenix/components";
import { DatasetSelectWithSplits } from "@phoenix/components/dataset";
import { DatasetExampleSelect } from "@phoenix/components/dataset/DatasetExampleSelect";
import { EvaluatorInputPreview } from "@phoenix/components/evaluators/EvaluatorInputPreview";

type EvaluatorExampleDatasetProps = {
  selectedDatasetId: string | null;
  onSelectDataset: (datasetId: string | null) => void;
  selectedSplitIds: string[];
  onSelectSplits: (splitIds: string[]) => void;
  selectedExampleId: string | null;
  onSelectExampleId: (exampleId: string | null) => void;
  datasetSelectIsDisabled?: boolean;
};

export const EvaluatorExampleDataset = ({
  selectedDatasetId,
  onSelectDataset,
  selectedSplitIds,
  onSelectSplits,
  selectedExampleId,
  onSelectExampleId,
  datasetSelectIsDisabled,
}: EvaluatorExampleDatasetProps) => {
  const [datasetSelectIsOpen, setDatasetSelectIsOpen] = useState(false);
  return (
    <>
      <Flex direction="column" gap="size-100">
        <Flex direction="column" gap="size-100">
          <Heading level={3}>Dataset</Heading>
          <Text color="text-500">
            Define a connection between this evaluator and a dataset.
          </Text>
        </Flex>
        <div
          css={css`
            width: 100%;
            display: grid;
            grid-template-columns: 3fr 1fr;
            gap: var(--ac-global-dimension-size-100);
          `}
        >
          <DatasetSelectWithSplits
            shouldFlip
            value={{ datasetId: selectedDatasetId, splitIds: selectedSplitIds }}
            onSelectionChange={({ datasetId, splitIds }) => {
              onSelectDataset(datasetId);
              onSelectSplits(splitIds);
              setDatasetSelectIsOpen(false);
            }}
            hideSplits
            isDisabled={datasetSelectIsDisabled}
            isOpen={datasetSelectIsOpen}
            onOpenChange={setDatasetSelectIsOpen}
          />
          <DatasetExampleSelect
            datasetId={selectedDatasetId}
            selectedExampleId={selectedExampleId}
            onSelectExampleId={onSelectExampleId}
          />
        </div>
      </Flex>
      <Flex direction="column" gap="size-100">
        <Heading level={3}>Preview evaluator input context</Heading>
        <Text color="text-500">
          Based on the connected dataset and selected example, your evaluator
          will receive the following input context.
        </Text>
      </Flex>
      <EvaluatorInputPreview
        datasetId={selectedDatasetId}
        splitIds={selectedSplitIds}
        exampleId={selectedExampleId}
        onSelectExampleId={onSelectExampleId}
      />
    </>
  );
};
