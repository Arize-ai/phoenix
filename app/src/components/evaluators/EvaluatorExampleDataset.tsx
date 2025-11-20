import { Flex, Text } from "@phoenix/components";
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
  return (
    <Flex direction="column" gap="size-100">
      <DatasetSelectWithSplits
        shouldFlip
        value={{ datasetId: selectedDatasetId, splitIds: selectedSplitIds }}
        onSelectionChange={({ datasetId, splitIds }) => {
          onSelectDataset(datasetId);
          onSelectSplits(splitIds);
        }}
        isDisabled={datasetSelectIsDisabled}
      />
      <Text color="text-500">
        Based on the selected dataset example, your evaluator will receive the
        following hypothetical context.
      </Text>
      <EvaluatorInputPreview
        datasetId={selectedDatasetId}
        splitIds={selectedSplitIds}
        onSelectExampleId={onSelectExampleId}
      />
    </Flex>
  );
};
