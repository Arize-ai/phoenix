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
import { EvaluatorSelect } from "@phoenix/components/evaluators/EvaluatorSelect";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { PlaygroundDatasetSelect } from "@phoenix/pages/playground/PlaygroundDatasetSelect";
import { Mutable } from "@phoenix/typeUtils";
import { prependBasename } from "@phoenix/utils/routingUtils";

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

  // eslint-disable-next-line no-console
  console.warn(
    "Using global evaluators. Use dataset evaluators when assignment becomes available."
  );
  const data = useLazyLoadQuery<PlaygroundDatasetSectionQuery>(
    graphql`
      query PlaygroundDatasetSectionQuery($datasetId: ID!, $splitIds: [ID!]) {
        evaluators {
          edges {
            evaluator: node {
              id
              name
              kind
            }
          }
        }
        dataset: node(id: $datasetId) {
          ... on Dataset {
            name
            # TODO: uncomment this when you can assign evaluators to datasets
            # evaluators {
            #   edges {
            #     evaluator: node {
            #       id
            #       name
            #       kind
            #     }
            #   }
            # }
          }
        }
      }
    `,
    {
      datasetId,
      splitIds: splitIds ?? null,
    }
  );

  const evaluators =
    data.evaluators?.edges?.map((edge) => edge.evaluator) ?? [];
  const [selectedEvaluatorIds, setSelectedEvaluatorIds] = useState<string[]>(
    () => evaluators.map((evaluator) => evaluator.id) ?? []
  );

  return (
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
        <Flex justifyContent="space-between" alignItems="center" height="100%">
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
                          <Text>+ {selectedEvaluatorIds.length - 3} more</Text>
                        </Token>,
                      ]
                    : []),
                ])}
            </Flex>
            <EvaluatorSelect
              evaluators={evaluators as Mutable<(typeof evaluators)[number]>[]}
              selectedIds={selectedEvaluatorIds}
              onSelectionChange={(id: string) => {
                setSelectedEvaluatorIds((prev) => {
                  if (prev.includes(id)) {
                    return prev.filter((evaluatorId) => evaluatorId !== id);
                  }
                  return [...prev, id];
                });
              }}
              addNewEvaluatorLink={prependBasename("/evaluators/new")}
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
          evaluatorIds={selectedEvaluatorIds}
        />
      </PlaygroundDatasetExamplesTableProvider>
    </Flex>
  );
}
