import { useCallback, useMemo, useState } from "react";
import { graphql, readInlineData, useLazyLoadQuery } from "react-relay";

import { Flex } from "@phoenix/components";
import { type AnnotationConfig } from "@phoenix/components/annotation";
import { EvaluatorItem } from "@phoenix/components/evaluators/EvaluatorSelectMenuItem";
import { EvaluatorInputMappingInput } from "@phoenix/pages/playground/__generated__/PlaygroundDatasetExamplesTableMutation.graphql";
import {
  PlaygroundDatasetSection_evaluator$data,
  PlaygroundDatasetSection_evaluator$key,
} from "@phoenix/pages/playground/__generated__/PlaygroundDatasetSection_evaluator.graphql";
import { PlaygroundDatasetSectionQuery } from "@phoenix/pages/playground/__generated__/PlaygroundDatasetSectionQuery.graphql";
import { Mutable } from "@phoenix/typeUtils";

import { PlaygroundDatasetExamplesTable } from "./PlaygroundDatasetExamplesTable";
import { PlaygroundDatasetExamplesTableProvider } from "./PlaygroundDatasetExamplesTableContext";
import { PlaygroundExperimentToolbar } from "./PlaygroundExperimentToolbar";

export function PlaygroundDatasetSection({
  datasetId,
  splitIds,
}: {
  datasetId: string;
  splitIds?: string[];
}) {
  const data = useLazyLoadQuery<PlaygroundDatasetSectionQuery>(
    graphql`
      query PlaygroundDatasetSectionQuery($datasetId: ID!) {
        dataset: node(id: $datasetId) {
          ... on Dataset {
            datasetEvaluators(first: 100)
              @connection(key: "PlaygroundDatasetSection_datasetEvaluators") {
              __id
              edges {
                node {
                  ...PlaygroundDatasetSection_evaluator
                }
              }
            }
          }
        }
        ...PlaygroundEvaluatorSelect_query
      }
    `,
    {
      datasetId,
    },
    {
      fetchPolicy: "network-only",
    }
  );

  type DatasetEvaluatorNode = PlaygroundDatasetSection_evaluator$data;
  const datasetEvaluators: (DatasetEvaluatorNode & EvaluatorItem)[] = useMemo(
    () =>
      data.dataset.datasetEvaluators?.edges?.map((edge) => {
        const evaluator =
          readInlineData<PlaygroundDatasetSection_evaluator$key>(
            graphql`
              fragment PlaygroundDatasetSection_evaluator on DatasetEvaluator
              @inline {
                id
                displayName
                inputMapping {
                  literalMapping
                  pathMapping
                }
                evaluator {
                  id
                  kind
                  isBuiltin
                }
                outputConfig {
                  name
                  optimizationDirection
                  values {
                    label
                    score
                  }
                }
              }
            `,
            edge.node
          );
        return {
          ...evaluator,
          kind: evaluator.evaluator.kind,
          isBuiltIn: evaluator.evaluator.isBuiltin,
          isAssignedToDataset: true,
          annotationName: evaluator.displayName,
        };
      }) ?? [],
    [data.dataset.datasetEvaluators]
  );
  const [selectedDatasetEvaluatorIds, setSelectedDatasetEvaluatorIds] =
    useState<string[]>(
      () =>
        datasetEvaluators.map((datasetEvaluator) => datasetEvaluator.id) ?? []
    );
  const onEvaluatorCreated = useCallback((datasetEvaluatorId: string) => {
    setSelectedDatasetEvaluatorIds((prev) => [...prev, datasetEvaluatorId]);
  }, []);
  const selectedEvaluatorWithInputMapping = useMemo(() => {
    return datasetEvaluators
      .filter((datasetEvaluator) =>
        selectedDatasetEvaluatorIds.includes(datasetEvaluator.id)
      )
      .reduce(
        (acc, datasetEvaluator) => {
          acc[datasetEvaluator.evaluator.id] =
            datasetEvaluator.inputMapping as Mutable<EvaluatorInputMappingInput>;
          return acc;
        },
        {} as Record<string, EvaluatorInputMappingInput>
      );
  }, [datasetEvaluators, selectedDatasetEvaluatorIds]);
  const evaluatorOutputConfigs: AnnotationConfig[] = useMemo(() => {
    return datasetEvaluators
      .filter((evaluator) => selectedDatasetEvaluatorIds.includes(evaluator.id))
      .map((evaluator): AnnotationConfig => {
        // LLM evaluators have outputConfig with categorical values
        if (evaluator.outputConfig != null) {
          return {
            name: evaluator.outputConfig.name,
            optimizationDirection: evaluator.outputConfig.optimizationDirection,
            values: evaluator.outputConfig.values,
            annotationType: "CATEGORICAL",
          };
        }
        // TODO(mikeldking): this is not correct but needs to be fixed on the back-end
        return {
          name: evaluator.displayName,
          annotationType: "FREEFORM",
        };
      });
  }, [datasetEvaluators, selectedDatasetEvaluatorIds]);

  return (
    <>
      <Flex direction={"column"} height={"100%"}>
        <PlaygroundExperimentToolbar
          datasetId={datasetId}
          datasetEvaluators={datasetEvaluators}
          selectedDatasetEvaluatorIds={selectedDatasetEvaluatorIds}
          onSelectionChange={setSelectedDatasetEvaluatorIds}
          updateConnectionIds={
            data.dataset.datasetEvaluators?.__id != null
              ? [data.dataset.datasetEvaluators.__id]
              : []
          }
          onEvaluatorCreated={onEvaluatorCreated}
          query={data}
        />
        <PlaygroundDatasetExamplesTableProvider>
          <PlaygroundDatasetExamplesTable
            datasetId={datasetId}
            splitIds={splitIds}
            evaluatorMappings={selectedEvaluatorWithInputMapping}
            evaluatorOutputConfigs={evaluatorOutputConfigs}
          />
        </PlaygroundDatasetExamplesTableProvider>
      </Flex>
    </>
  );
}
