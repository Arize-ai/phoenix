import { Flex } from "@phoenix/components";
import { DatasetSelectWithSplits } from "@phoenix/components/dataset";
import { EvaluatorDatasetExamplePreview } from "@phoenix/pages/evaluators/EvaluatorDatasetExamplePreview";

type EvaluatorExampleDatasetProps = {
  selectedDatasetId: string | null;
  onSelectDataset: (datasetId: string | null) => void;
  selectedSplitIds: string[];
  onSelectSplits: (splitIds: string[]) => void;
};

export const EvaluatorExampleDataset = ({
  selectedDatasetId,
  onSelectDataset,
  selectedSplitIds,
  onSelectSplits,
}: EvaluatorExampleDatasetProps) => {
  return (
    <Flex direction="column" gap="size-100">
      <DatasetSelectWithSplits
        value={{ datasetId: selectedDatasetId, splitIds: selectedSplitIds }}
        onSelectionChange={({ datasetId, splitIds }) => {
          onSelectDataset(datasetId);
          onSelectSplits(splitIds);
        }}
      />
      <EvaluatorDatasetExamplePreview
        datasetId={selectedDatasetId}
        splitIds={selectedSplitIds}
      />
    </Flex>
  );
};
