import { Checkbox, Flex, Label } from "@phoenix/components";
import { DatasetSelectWithSplits } from "@phoenix/components/dataset";
import { EvaluatorDatasetExamplePreview } from "@phoenix/components/evaluators/EvaluatorDatasetExamplePreview";

type EvaluatorExampleDatasetProps = {
  selectedDatasetId: string | null;
  onSelectDataset: (datasetId: string | null) => void;
  selectedSplitIds: string[];
  onSelectSplits: (splitIds: string[]) => void;
  onSelectExampleId: (exampleId: string | null) => void;
  datasetSelectIsDisabled?: boolean;
  assignEvaluatorToDataset?: boolean;
  onAssignEvaluatorToDataset?: (assignEvaluatorToDataset: boolean) => void;
};

export const EvaluatorExampleDataset = ({
  selectedDatasetId,
  onSelectDataset,
  selectedSplitIds,
  onSelectSplits,
  onSelectExampleId,
  datasetSelectIsDisabled,
  assignEvaluatorToDataset,
  onAssignEvaluatorToDataset,
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
      {/* just hide the checkbox if changing the dataset is disabled */}
      {/* the association will be implicit given the readonly dataset */}
      {!datasetSelectIsDisabled && (
        <Checkbox
          isSelected={assignEvaluatorToDataset}
          onChange={onAssignEvaluatorToDataset}
          isDisabled={datasetSelectIsDisabled || !selectedDatasetId}
        >
          <Label>Assign evaluator to this dataset</Label>
        </Checkbox>
      )}
    </Flex>
  );
};
