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
                name
                inputMapping {
                  literalMapping
                  pathMapping
                }
                evaluator {
                  id
                  kind
                  isBuiltin
                }
                outputConfigs {
                  ... on CategoricalAnnotationConfig {
                    name
                    optimizationDirection
                    values {
                      label
                      score
                    }
                  }
                  ... on ContinuousAnnotationConfig {
                    name
                    optimizationDirection
                    lowerBound
                    upperBound
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
          annotationName: evaluator.name,
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
          acc[datasetEvaluator.id] = {
            name: datasetEvaluator.name,
            inputMapping:
              datasetEvaluator.inputMapping as Mutable<EvaluatorInputMappingInput>,
          };
          return acc;
        },
        {} as Record<
          string,
          { name: string; inputMapping: EvaluatorInputMappingInput }
        >
      );
  }, [datasetEvaluators, selectedDatasetEvaluatorIds]);
  const evaluatorOutputConfigs: AnnotationConfig[] = useMemo(() => {
    return datasetEvaluators
      .filter((datasetEvaluator) =>
        selectedDatasetEvaluatorIds.includes(datasetEvaluator.id)
      )
      .flatMap((datasetEvaluator) => {
        const outputConfigs = datasetEvaluator.outputConfigs;
        if (!outputConfigs || outputConfigs.length === 0) {
          // TODO: all evaluators should have an output config eventually
          return [
            {
              name: datasetEvaluator.name,
              annotationType: "FREEFORM",
            } satisfies AnnotationConfig,
          ];
        }
        return outputConfigs.map((outputConfig) => {
          // Handle CategoricalAnnotationConfig from the union
          if ("values" in outputConfig && outputConfig.values) {
            return {
              name: outputConfig.name ?? datasetEvaluator.name,
              optimizationDirection: outputConfig.optimizationDirection,
              values: outputConfig.values,
              annotationType: "CATEGORICAL",
            } satisfies AnnotationConfig;
          }
          // Handle ContinuousAnnotationConfig from the union
          if ("lowerBound" in outputConfig || "upperBound" in outputConfig) {
            return {
              name: outputConfig.name ?? datasetEvaluator.name,
              optimizationDirection: outputConfig.optimizationDirection,
              lowerBound: outputConfig.lowerBound,
              upperBound: outputConfig.upperBound,
              annotationType: "CONTINUOUS",
            } satisfies AnnotationConfig;
          }
          // Fallback for freeform or unknown types
          return {
            name: datasetEvaluator.name,
            annotationType: "FREEFORM",
          } satisfies AnnotationConfig;
        });
      });
  }, [datasetEvaluators, selectedDatasetEvaluatorIds]);

  // We want to re-mount the context when the dataset or the splits change
  const key = `${datasetId}-${splitIds?.join("-")}`;
  return (
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
      <PlaygroundDatasetExamplesTableProvider key={key}>
        <PlaygroundDatasetExamplesTable
          datasetId={datasetId}
          splitIds={splitIds}
          evaluatorMappings={selectedEvaluatorWithInputMapping}
          evaluatorOutputConfigs={evaluatorOutputConfigs}
        />
      </PlaygroundDatasetExamplesTableProvider>
    </Flex>
  );
}
