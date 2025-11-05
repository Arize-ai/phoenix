import { Flex } from "@phoenix/components";
import { DatasetSelectWithSplits } from "@phoenix/components/dataset";
import { EvaluatorDatasetExamplePreview } from "@phoenix/components/evaluators/EvaluatorDatasetExamplePreview";

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
      <EvaluatorDatasetExamplePreview
        datasetId={selectedDatasetId}
        splitIds={selectedSplitIds}
        onSelectExampleId={onSelectExampleId}
      />
    </Flex>
  );
};
