import { useMemo } from "react";
import { graphql, useFragment } from "react-relay";
import { useSearchParams } from "react-router";
import { css } from "@emotion/react";

import { Flex, Text } from "@phoenix/components";
import { useExperimentColors } from "@phoenix/components/experiment";
import { SequenceNumberToken } from "@phoenix/components/experiment/SequenceNumberToken";

import type {
  SelectedCompareExperiments_dataset$data,
  SelectedCompareExperiments_dataset$key,
} from "./__generated__/SelectedCompareExperiments_dataset.graphql";

type Experiment = NonNullable<
  SelectedCompareExperiments_dataset$data["dataset"]["experiments"]
>["edges"][number]["experiment"];

export function SelectedCompareExperiments({
  dataRef,
}: {
  dataRef: SelectedCompareExperiments_dataset$key;
}) {
  const [searchParams] = useSearchParams();
  const [, ...compareExperimentIds] = searchParams.getAll("experimentId");
  const { getExperimentColor } = useExperimentColors();
  const data = useFragment<SelectedCompareExperiments_dataset$key>(
    graphql`
      fragment SelectedCompareExperiments_dataset on Query
      @argumentDefinitions(
        datasetId: { type: "ID!" }
        experimentIds: { type: "[ID!]!" }
      ) {
        dataset: node(id: $datasetId) {
          ... on Dataset {
            experiments(filterIds: $experimentIds) {
              edges {
                experiment: node {
                  id
                  sequenceNumber
                  name
                }
              }
            }
          }
        }
      }
    `,
    dataRef
  );
  const idToExperiment = useMemo(() => {
    const idToExperiment: Record<string, Experiment> = {};
    data.dataset.experiments?.edges.forEach((edge) => {
      idToExperiment[edge.experiment.id] = edge.experiment;
    });
    return idToExperiment;
  }, [data]);
  if (compareExperimentIds.length === 0) {
    return null;
  }
  const compareExperiments = compareExperimentIds.map(
    (experimentId) => idToExperiment[experimentId]
  );
  return (
    <Flex direction="row" gap="size-200" alignItems="center">
      {compareExperiments.map((experiment, experimentIndex) => (
        <Flex
          direction="row"
          gap="size-100"
          key={experiment.id}
          alignItems="center"
        >
          <SequenceNumberToken
            sequenceNumber={experiment.sequenceNumber}
            color={getExperimentColor(experimentIndex)}
          />
          <Text
            css={css`
              white-space: nowrap;
              max-width: var(--ac-global-dimension-size-2000);
              overflow: hidden;
              text-overflow: ellipsis;
            `}
          >
            {experiment.name}
          </Text>
        </Flex>
      ))}
    </Flex>
  );
}
