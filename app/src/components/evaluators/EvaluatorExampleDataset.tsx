import { Suspense } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { useShallow } from "zustand/react/shallow";

import { Flex, Icon, Icons, Text } from "@phoenix/components";
import { EvaluatorExampleDatasetQuery } from "@phoenix/components/evaluators/__generated__/EvaluatorExampleDatasetQuery.graphql";
import { EvaluatorExampleSelect } from "@phoenix/components/evaluators/EvaluatorExampleSelect";
import { Truncate } from "@phoenix/components/utility/Truncate";
import { useEvaluatorStore } from "@phoenix/contexts/EvaluatorContext";

export const EvaluatorExampleDataset = () => {
  return (
    <Suspense>
      <EvaluatorExampleDatasetContent />
    </Suspense>
  );
};

const EvaluatorExampleDatasetContent = () => {
  const { selectedDatasetId, selectedExampleId, setSelectedExampleId } =
    useEvaluatorStore(
      useShallow((state) => {
        if (!state.dataset) {
          throw new Error("Dataset is required to preview the evaluator input");
        }
        return {
          selectedDatasetId: state.dataset.id,
          selectedExampleId: state.dataset.selectedExampleId,
          setSelectedExampleId: state.setSelectedExampleId,
        };
      })
    );

  const data = useLazyLoadQuery<EvaluatorExampleDatasetQuery>(
    graphql`
      query EvaluatorExampleDatasetQuery($datasetId: ID!) {
        dataset: node(id: $datasetId) {
          ... on Dataset {
            id
            name
          }
        }
      }
    `,
    { datasetId: selectedDatasetId }
  );

  const datasetName = data.dataset?.name ?? "Unknown Dataset";

  return (
    <>
      <Flex direction="column" gap="size-100">
        <Flex direction="column" gap="size-100">
          <DatasetNameDisplay name={datasetName} />
        </Flex>
        <EvaluatorExampleSelect
          datasetId={selectedDatasetId}
          selectedExampleId={selectedExampleId}
          onSelectExampleId={setSelectedExampleId}
        />
      </Flex>
    </>
  );
};

const DatasetNameDisplay = ({ name }: { name: string }) => {
  return (
    <Flex direction="row" alignItems="center" gap="size-100">
      <Icon svg={<Icons.DatabaseOutline />} />
      <Text>
        <Truncate maxWidth="100%">{name}</Truncate>
      </Text>
    </Flex>
  );
};
