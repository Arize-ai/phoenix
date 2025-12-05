import { useMemo, useState } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

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
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { EvaluatorInputMappingInput } from "@phoenix/pages/playground/__generated__/PlaygroundDatasetExamplesTableMutation.graphql";
import { PlaygroundEvaluatorSelect } from "@phoenix/pages/playground/PlaygroundEvaluatorSelect";
import { Mutable } from "@phoenix/typeUtils";

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
      query PlaygroundDatasetSectionQuery($datasetId: ID!) {
        dataset: node(id: $datasetId) {
          ... on Dataset {
            evaluators(first: 100) {
              edges {
                node {
                  id
                  name
                  kind
                  datasetInputMapping {
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
          ...EvaluatorConfigDialog_dataset
        }
      }
    `,
    {
      datasetId,
    }
  );

  const evaluators = useMemo(
    () =>
      data.dataset.evaluators?.edges?.map((edge) => ({
        ...edge.node,
        isAssignedToDataset: true,
        annotationName: edge.node?.outputConfig?.name,
      })) ?? [],
    [data.dataset.evaluators]
  );
  const [selectedEvaluatorIds, setSelectedEvaluatorIds] = useState<string[]>(
    () =>
      data.dataset.evaluators?.edges.map((evaluator) => evaluator.node.id) ?? []
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
              <Text>Experiment</Text>
              {experimentIds.length > 0 ? (
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
              ) : null}
            </Flex>
            <Flex direction="row" gap="size-100" alignItems="center">
              <PlaygroundDatasetSelect />
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
                datasetId={datasetId}
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
