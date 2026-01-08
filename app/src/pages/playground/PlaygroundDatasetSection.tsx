import { useCallback, useMemo, useState } from "react";
import { graphql, readInlineData, useLazyLoadQuery } from "react-relay";
import invariant from "tiny-invariant";

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
import type { EvaluatorMappingEntry } from "./playgroundUtils";

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
                  ... on LLMEvaluator {
                    outputConfig {
                      name
                      optimizationDirection
                      values {
                        label
                        score
                      }
                    }
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
          annotationName: evaluator?.evaluator?.outputConfig?.name,
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
          acc[datasetEvaluator.evaluator.id] = {
            inputMapping:
              datasetEvaluator.inputMapping as Mutable<EvaluatorInputMappingInput>,
            displayName: datasetEvaluator.displayName,
          };
          return acc;
        },
        {} as Record<string, EvaluatorMappingEntry>
      );
  }, [datasetEvaluators, selectedDatasetEvaluatorIds]);
  const evaluatorOutputConfigs: AnnotationConfig[] = useMemo(() => {
    return datasetEvaluators
      .filter(
        (evaluator) =>
          selectedDatasetEvaluatorIds.includes(evaluator.id) &&
          evaluator.evaluator.outputConfig != null
      )
      .map((evaluator) => {
        // the filter above should ensure that the output config is not null, but we add the invariant to be safe
        invariant(
          evaluator.evaluator.outputConfig != null,
          "Evaluator output config is required"
        );
        return {
          name: evaluator.evaluator.outputConfig.name,
          optimizationDirection:
            evaluator.evaluator.outputConfig.optimizationDirection,
          values: evaluator.evaluator.outputConfig.values,
          annotationType: "CATEGORICAL",
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
