import { useState } from "react";
import { css } from "@emotion/react";

import { Flex, Heading, Text } from "@phoenix/components";
import { DatasetSelectWithSplits } from "@phoenix/components/dataset";
import { DatasetExampleSelect } from "@phoenix/components/dataset/DatasetExampleSelect";
import { EvaluatorInputPreview } from "@phoenix/components/evaluators/EvaluatorInputPreview";
import { EvaluatorInput } from "@phoenix/components/evaluators/utils";

type EvaluatorExampleDatasetProps = {
  selectedDatasetId: string | null;
  onSelectDataset: (datasetId: string | null) => void;
  selectedSplitIds: string[];
  onSelectSplits: (splitIds: string[]) => void;
  selectedExampleId: string | null;
  onSelectExampleId: (exampleId: string | null) => void;
  datasetSelectIsDisabled?: boolean;
  onEvaluatorInputObjectChange: (
    evaluatorInputObject: EvaluatorInput | null
  ) => void;
};

export const EvaluatorExampleDataset = ({
  selectedDatasetId,
  onSelectDataset,
  selectedSplitIds,
  onSelectSplits,
  selectedExampleId,
  onSelectExampleId,
  datasetSelectIsDisabled,
  onEvaluatorInputObjectChange,
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
          You can edit the input context below in order to simulate different
          shapes of data your evaluator may encounter. By default, the input
          context is derived from the connected dataset.
        </Text>
      </Flex>
      <EvaluatorInputPreview
        datasetId={selectedDatasetId}
        splitIds={selectedSplitIds}
        exampleId={selectedExampleId}
        onSelectExampleId={onSelectExampleId}
        setEvaluatorInputObject={onEvaluatorInputObjectChange}
      />
    </>
  );
};
