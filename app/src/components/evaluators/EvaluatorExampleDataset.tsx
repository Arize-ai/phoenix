import { useState } from "react";

import { Flex, Heading, Text } from "@phoenix/components";
import { DatasetSelectWithSplits } from "@phoenix/components/dataset";
import { EvaluatorInputPreview } from "@phoenix/components/evaluators/EvaluatorInputPreview";

type EvaluatorExampleDatasetProps = {
  selectedDatasetId: string | null;
  onSelectDataset: (datasetId: string | null) => void;
  selectedSplitIds: string[];
  onSelectSplits: (splitIds: string[]) => void;
  onSelectExampleId: (exampleId: string | null) => void;
  datasetSelectIsDisabled?: boolean;
};

export const EvaluatorExampleDataset = ({
  selectedDatasetId,
  onSelectDataset,
  selectedSplitIds,
  onSelectSplits,
  onSelectExampleId,
  datasetSelectIsDisabled,
}: EvaluatorExampleDatasetProps) => {
  const [datasetSelectIsOpen, setDatasetSelectIsOpen] = useState(false);
  return (
    <>
      <Flex direction="column" gap="size-100">
        <Flex direction="column" gap="size-100">
          <Heading level={3}>Connect your evaluator</Heading>
          <Text color="text-500">
            Define a connection between this evaluator and a dataset.
          </Text>
        </Flex>
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
        onSelectExampleId={onSelectExampleId}
      />
    </>
  );
};
