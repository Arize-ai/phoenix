import { useMemo, useState } from "react";
import { graphql, useFragment, useLazyLoadQuery } from "react-relay";

import {
  Flex,
  Icon,
  Icons,
  LinkButton,
  Text,
  Token,
  View,
} from "@phoenix/components";
import { AnnotationNameAndValue } from "@phoenix/components/annotation";
import { DatasetSplits } from "@phoenix/components/datasetSplit/DatasetSplits";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { EvaluatorInputMappingInput } from "@phoenix/pages/playground/__generated__/PlaygroundDatasetExamplesTableMutation.graphql";
import { PlaygroundDatasetSection_evaluators$key } from "@phoenix/pages/playground/__generated__/PlaygroundDatasetSection_evaluators.graphql";
import { PlaygroundEvaluatorSelect } from "@phoenix/pages/playground/PlaygroundEvaluatorSelect";
import { Mutable } from "@phoenix/typeUtils";
import { prependBasename } from "@phoenix/utils/routingUtils";

import { PlaygroundDatasetSectionQuery } from "./__generated__/PlaygroundDatasetSectionQuery.graphql";
import { PlaygroundDatasetExamplesTable } from "./PlaygroundDatasetExamplesTable";
import { PlaygroundDatasetExamplesTableProvider } from "./PlaygroundDatasetExamplesTableContext";

export function PlaygroundDatasetSection({
  datasetId,
  splitIds,
}: {
  datasetId: string;
  splitIds?: string[];
}) {
  const instances = usePlaygroundContext((state) => state.instances);
  const isRunning = instances.some((instance) => instance.activeRunId != null);
  const experimentIds = useMemo(() => {
    return instances
      .map((instance) => instance.experimentId)
      .filter((id) => id != null);
  }, [instances]);

  const data = useLazyLoadQuery<PlaygroundDatasetSectionQuery>(
    graphql`
      query PlaygroundDatasetSectionQuery($datasetId: ID!, $splitIds: [ID!]) {
        dataset: node(id: $datasetId) {
          ... on Dataset {
            name
            exampleCount(splitIds: $splitIds)
            splits {
              id
              name
              color
            }
            ...PlaygroundDatasetSection_evaluators
              @arguments(datasetId: $datasetId)
          }
          ...EvaluatorConfigDialog_dataset
        }
      }
    `,
    {
      datasetId,
      splitIds: splitIds ?? null,
    }
  );

  const evaluatorsData = useFragment<PlaygroundDatasetSection_evaluators$key>(
    graphql`
      fragment PlaygroundDatasetSection_evaluators on Dataset
      @argumentDefinitions(datasetId: { type: "ID!" }) {
        evaluators(first: 100) {
          edges {
            evaluator: node {
              id
              name
              datasetInputMapping(datasetId: $datasetId) {
                literalMapping
                pathMapping
              }
              ... on LLMEvaluator {
                outputConfig {
                  name
                }
              }
            }
          }
        }
      }
    `,
    data.dataset
  );

  // Filter to only the selected splits
  const selectedSplits = useMemo(() => {
    if (!splitIds || !data.dataset.splits) {
      return [];
    }
    return data.dataset.splits
      .filter((split) => splitIds.includes(split.id))
      .map((split) => ({
        id: split.id,
        name: split.name,
        color: split.color ?? "#808080",
      }));
  }, [data, splitIds]);

  const evaluators = useMemo(
    () =>
      evaluatorsData.evaluators?.edges?.map((edge) => ({
        ...edge.evaluator,
        annotationName: edge.evaluator.outputConfig?.name,
      })) ?? [],
    [evaluatorsData]
  );
  const [selectedEvaluatorIds, setSelectedEvaluatorIds] = useState<string[]>(
    () => evaluators.map((evaluator) => evaluator.id) ?? []
  );
  const selectedEvaluatorWithInputMapping = useMemo(() => {
    return evaluators
      .filter((evaluator) => selectedEvaluatorIds.includes(evaluator.id))
      .reduce(
        (acc, evaluator) => {
          acc[evaluator.id] =
            evaluator.datasetInputMapping as Mutable<EvaluatorInputMappingInput>;
          return acc;
        },
        {} as Record<string, EvaluatorInputMappingInput>
      );
  }, [evaluators, selectedEvaluatorIds]);

  return (
    <>
      <Flex direction={"column"} height={"100%"}>
        <View
          flex="none"
          backgroundColor={"dark"}
          paddingX="size-200"
          paddingY={"size-100"}
          borderBottomColor={"light"}
          borderBottomWidth={"thin"}
          height={50}
        >
          <Flex
            justifyContent="space-between"
            alignItems="center"
            height="100%"
          >
            <Flex gap="size-100" alignItems="center">
              <Text>{data.dataset.name ?? "Dataset"} results</Text>
              {selectedSplits.length > 0 && (
                <DatasetSplits labels={selectedSplits} />
              )}
              {data.dataset.exampleCount != null ? (
                <Text fontStyle="italic" color={"text-700"}>
                  {data.dataset.exampleCount} examples
                </Text>
              ) : null}
            </Flex>
            <Flex direction="row" gap="size-100" alignItems="center">
              <Flex direction="row" gap="size-100" alignItems="center">
                {evaluators
                  .filter((e) => selectedEvaluatorIds.includes(e.id))
                  .slice(0, 3)
                  .flatMap((e, index, array) => [
                    <AnnotationNameAndValue
                      key={e.id}
                      annotation={e}
                      displayPreference="none"
                      minWidth="auto"
                    />,
                    ...(index === array.length - 1 &&
                    selectedEvaluatorIds.length > 3
                      ? [
                          <Token key={`more`}>
                            <Text>
                              + {selectedEvaluatorIds.length - 3} more
                            </Text>
                          </Token>,
                        ]
                      : []),
                  ])}
              </Flex>
              <PlaygroundEvaluatorSelect
                evaluators={evaluators}
                selectedIds={selectedEvaluatorIds}
                onSelectionChange={setSelectedEvaluatorIds}
                addNewEvaluatorLink={prependBasename(`/evaluators/new`)}
              />
              {experimentIds.length > 0 && (
                <LinkButton
                  size="S"
                  isDisabled={isRunning}
                  leadingVisual={
                    <Icon
                      svg={
                        isRunning ? (
                          <Icons.LoadingOutline />
                        ) : (
                          <Icons.ExperimentOutline />
                        )
                      }
                    />
                  }
                  to={`/datasets/${datasetId}/compare?${experimentIds.map((id) => `experimentId=${id}`).join("&")}`}
                >
                  View Experiment{instances.length > 1 ? "s" : ""}
                </LinkButton>
              )}
            </Flex>
          </Flex>
        </View>
        <PlaygroundDatasetExamplesTableProvider>
          <PlaygroundDatasetExamplesTable
            datasetId={datasetId}
            splitIds={splitIds}
            evaluatorMappings={selectedEvaluatorWithInputMapping}
          />
        </PlaygroundDatasetExamplesTableProvider>
      </Flex>
    </>
  );
}
