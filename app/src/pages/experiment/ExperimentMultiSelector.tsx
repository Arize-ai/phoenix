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
  selectedBaselineExperimentId: string | undefined;
  selectedCompareExperimentIds: string[];
  onChange: (
    selectedBaselineExperimentId: string | undefined,
    selectedCompareExperimentIds: string[]
  ) => void;
  dataRef: ExperimentMultiSelector__data$key;
}) {
  const {
    selectedBaselineExperimentId,
    selectedCompareExperimentIds,
    onChange,
    dataRef,
  } = props;

  const data = useFragment(
    graphql`
      fragment ExperimentMultiSelector__data on Query
      @argumentDefinitions(hasBaselineExperimentId: { type: "Boolean!" }) {
        dataset: node(id: $datasetId) {
          id
          ... on Dataset {
            id
            name
            experiments {
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
        baselineExperiment: node(id: $baselineExperimentId)
          @include(if: $hasBaselineExperimentId) {
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
      data.dataset.experiments?.edges.map((edge) => {
        return edge.experiment;
      }) ?? []
    );
  }, [data]);
  const baselineExperimentDisplayText = useMemo(
    () => data.baselineExperiment?.name ?? "No baseline selected",
    [data.baselineExperiment]
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
        <Label>baseline experiment</Label>
        <DialogTrigger>
          <Button size="M" trailingVisual={<SelectChevronUpDownIcon />}>
            {baselineExperimentDisplayText}
          </Button>
          <Popover placement="bottom start">
            <Dialog>
              <ListBox
                selectionMode="single"
                selectionBehavior="replace"
                selectedKeys={
                  new Set(
                    selectedBaselineExperimentId
                      ? [selectedBaselineExperimentId]
                      : []
                  )
                }
                onSelectionChange={(keys) => {
                  const [baselineExperimentId] = keys;
                  invariant(
                    typeof baselineExperimentId !== "number",
                    "baselineExperimentId should not be a number"
                  );
                  const compareExperimentIds = [
                    ...(selectedBaselineExperimentId
                      ? [selectedBaselineExperimentId]
                      : []),
                    ...selectedCompareExperimentIds.filter(
                      (id) => id !== baselineExperimentId
                    ),
                  ];
                  onChange(baselineExperimentId, compareExperimentIds);
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
      {selectedBaselineExperimentId && (
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
                        selectedBaselineExperimentId,
                        experiments.map((exp) => exp.id)
                      );
                    } else {
                      onChange(
                        selectedBaselineExperimentId,
                        Array.from(keys) as string[]
                      );
                    }
                  }}
                >
                  {experiments
                    .filter(
                      (experiment) =>
                        experiment.id !== selectedBaselineExperimentId
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
