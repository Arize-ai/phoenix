import { useMemo } from "react";
import { graphql, useFragment } from "react-relay";
import invariant from "tiny-invariant";
import { css } from "@emotion/react";

import {
  Button,
  Dialog,
  DialogTrigger,
  Flex,
  Icon,
  Icons,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  SelectChevronUpDownIcon,
  Text,
} from "@phoenix/components";
import { SequenceNumberToken } from "@phoenix/components/experiment/SequenceNumberToken";
import { fieldBaseCSS } from "@phoenix/components/field/styles";
import { selectCSS } from "@phoenix/components/select/styles";

import type { ExperimentMultiSelector__data$key } from "./__generated__/ExperimentMultiSelector__data.graphql";

export function ExperimentMultiSelector(props: {
  selectedBaseExperimentId: string | undefined;
  selectedCompareExperimentIds: string[];
  onChange: (
    selectedBaseExperimentId: string | undefined,
    selectedCompareExperimentIds: string[]
  ) => void;
  dataRef: ExperimentMultiSelector__data$key;
}) {
  const {
    selectedBaseExperimentId,
    selectedCompareExperimentIds,
    onChange,
    dataRef,
  } = props;

  const data = useFragment(
    graphql`
      fragment ExperimentMultiSelector__data on Query
      @argumentDefinitions(
        datasetId: { type: "ID!" }
        hasBaseExperiment: { type: "Boolean!" }
      ) {
        dataset: node(id: $datasetId) {
          id
          ... on Dataset {
            id
            name
            allExperiments: experiments {
              edges {
                experiment: node {
                  id
                  name
                  sequenceNumber
                  createdAt
                }
              }
            }
          }
        }
        baseExperiment: node(id: $baseExperimentId)
          @include(if: $hasBaseExperiment) {
          ... on Experiment {
            id
            name
          }
        }
      }
    `,
    dataRef
  );
  const experiments = useMemo(() => {
    return (
      data.dataset.allExperiments?.edges.map((edge) => {
        return edge.experiment;
      }) ?? []
    );
  }, [data]);
  const baseExperimentDisplayText = useMemo(
    () => data.baseExperiment?.name ?? "No base experiment selected",
    [data.baseExperiment]
  );
  const compareExperimentsDisplayText = useMemo(() => {
    const numExperiments = selectedCompareExperimentIds.length;
    return numExperiments > 0
      ? `${numExperiments} experiment${numExperiments > 1 ? "s" : ""}`
      : "No experiments selected";
  }, [selectedCompareExperimentIds]);

  // TODO: refactor to a multi-select component. See #8139
  return (
    <Flex direction="row" gap="size-100">
      <div css={css(fieldBaseCSS, selectCSS)}>
        <Label>base experiment</Label>
        <DialogTrigger>
          <Button size="M" trailingVisual={<SelectChevronUpDownIcon />}>
            {baseExperimentDisplayText}
          </Button>
          <Popover placement="bottom start">
            <Dialog>
              <ListBox
                selectionMode="single"
                selectionBehavior="replace"
                selectedKeys={
                  new Set(
                    selectedBaseExperimentId ? [selectedBaseExperimentId] : []
                  )
                }
                onSelectionChange={(keys) => {
                  const [baseExperimentId] = keys;
                  invariant(
                    typeof baseExperimentId !== "number",
                    "baseExperimentId should not be a number"
                  );
                  const compareExperimentIds = [
                    ...(selectedBaseExperimentId
                      ? [selectedBaseExperimentId]
                      : []),
                    ...selectedCompareExperimentIds.filter(
                      (id) => id !== baseExperimentId
                    ),
                  ];
                  onChange(baseExperimentId, compareExperimentIds);
                }}
              >
                {experiments.map((experiment) => (
                  <ListBoxItem key={experiment.id} id={experiment.id}>
                    {({ isSelected }) => (
                      <Flex
                        direction="row"
                        justifyContent="space-between"
                        alignItems="center"
                      >
                        <Flex direction="column" gap="size-50">
                          <Flex direction="row" gap="size-100">
                            <SequenceNumberToken
                              sequenceNumber={experiment.sequenceNumber}
                            />
                            <Text>{experiment.name}</Text>
                          </Flex>
                          <Text size="XS" color="text-700">
                            {new Date(experiment.createdAt).toLocaleString()}
                          </Text>
                        </Flex>
                        {isSelected && <Icon svg={<Icons.Checkmark />} />}
                      </Flex>
                    )}
                  </ListBoxItem>
                ))}
              </ListBox>
            </Dialog>
          </Popover>
        </DialogTrigger>
      </div>
      {selectedBaseExperimentId && (
        <div css={css(fieldBaseCSS, selectCSS)}>
          <Label>compare experiments</Label>
          <DialogTrigger>
            <Button size="M" trailingVisual={<SelectChevronUpDownIcon />}>
              {compareExperimentsDisplayText}
            </Button>
            <Popover placement="bottom start">
              <Dialog>
                <ListBox
                  selectionMode="multiple"
                  selectedKeys={new Set(selectedCompareExperimentIds)}
                  onSelectionChange={(keys) => {
                    if (keys === "all") {
                      onChange(
                        selectedBaseExperimentId,
                        experiments.map((exp) => exp.id)
                      );
                    } else {
                      onChange(
                        selectedBaseExperimentId,
                        Array.from(keys) as string[]
                      );
                    }
                  }}
                >
                  {experiments
                    .filter(
                      (experiment) => experiment.id !== selectedBaseExperimentId
                    )
                    .map((experiment) => (
                      <ListBoxItem key={experiment.id} id={experiment.id}>
                        {({ isSelected }) => (
                          <Flex
                            direction="row"
                            justifyContent="space-between"
                            alignItems="center"
                          >
                            <Flex direction="column" gap="size-50">
                              <Flex direction="row" gap="size-100">
                                <SequenceNumberToken
                                  sequenceNumber={experiment.sequenceNumber}
                                />
                                <Text>{experiment.name}</Text>
                              </Flex>
                              <Text size="XS" color="text-700">
                                {new Date(
                                  experiment.createdAt
                                ).toLocaleString()}
                              </Text>
                            </Flex>
                            {isSelected && <Icon svg={<Icons.Checkmark />} />}
                          </Flex>
                        )}
                      </ListBoxItem>
                    ))}
                </ListBox>
              </Dialog>
            </Popover>
          </DialogTrigger>
        </div>
      )}
    </Flex>
  );
}
