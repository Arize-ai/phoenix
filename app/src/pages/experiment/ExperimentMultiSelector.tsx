import { useMemo } from "react";
import {
  graphql,
  PreloadedQuery,
  useFragment,
  usePreloadedQuery,
} from "react-relay";
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
import { ColorSwatch } from "@phoenix/components/color/ColorSwatch";
import { useExperimentColors } from "@phoenix/components/experiment";
import { SequenceNumberToken } from "@phoenix/components/experiment/SequenceNumberToken";
import { fieldBaseCSS } from "@phoenix/components/field/styles";
import { selectCSS } from "@phoenix/components/select/styles";
import type { ExperimentComparePageQueriesMultiSelectorQuery as ExperimentComparePageQueriesMultiSelectorQueryType } from "@phoenix/pages/experiment/__generated__/ExperimentComparePageQueriesMultiSelectorQuery.graphql";
import { ExperimentComparePageQueriesMultiSelectorQuery } from "@phoenix/pages/experiment/ExperimentComparePageQueries";

import type {
  ExperimentMultiSelector__data$data,
  ExperimentMultiSelector__data$key,
} from "./__generated__/ExperimentMultiSelector__data.graphql";

type Experiment = NonNullable<
  ExperimentMultiSelector__data$data["dataset"]["allExperiments"]
>["edges"][number]["experiment"];

export function ExperimentMultiSelector(props: {
  selectedBaseExperimentId: string | undefined;
  selectedCompareExperimentIds: string[];
  onChange: (
    selectedBaseExperimentId: string | undefined,
    selectedCompareExperimentIds: string[]
  ) => void;
  queryRef: PreloadedQuery<ExperimentComparePageQueriesMultiSelectorQueryType>;
}) {
  const {
    selectedBaseExperimentId,
    selectedCompareExperimentIds,
    onChange,
    queryRef,
  } = props;
  const { baseExperimentColor } = useExperimentColors();

  const preloadedData =
    usePreloadedQuery<ExperimentComparePageQueriesMultiSelectorQueryType>(
      ExperimentComparePageQueriesMultiSelectorQuery,
      queryRef
    );

  const data = useFragment<ExperimentMultiSelector__data$key>(
    graphql`
      fragment ExperimentMultiSelector__data on Query
      @argumentDefinitions(
        datasetId: { type: "ID!" }
        hasBaseExperiment: { type: "Boolean!" }
        baseExperimentId: { type: "ID!" }
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
    preloadedData
  );

  const { allExperiments, nonBaseExperiments } = useMemo(() => {
    const allExperiments: Experiment[] = [];
    const nonBaseExperiments: Experiment[] = [];
    data.dataset.allExperiments?.edges.forEach((edge) => {
      const experiment = edge.experiment;
      allExperiments.push(experiment);
      if (experiment.id !== selectedBaseExperimentId) {
        nonBaseExperiments.push(experiment);
      }
    });
    return { allExperiments, nonBaseExperiments };
  }, [data.dataset.allExperiments, selectedBaseExperimentId]);
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
        <Label>experiment</Label>
        <DialogTrigger>
          <Button size="S" trailingVisual={<SelectChevronUpDownIcon />}>
            {data.baseExperiment != null ? (
              <Flex direction="row" gap="size-100" alignItems="center">
                <ColorSwatch color={baseExperimentColor} shape="circle" />
                <Text
                  css={css`
                    white-space: nowrap;
                    max-width: var(--ac-global-dimension-size-2000);
                    overflow: hidden;
                    text-overflow: ellipsis;
                  `}
                >
                  {data.baseExperiment.name}
                </Text>
              </Flex>
            ) : (
              "No experiment selected"
            )}
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
                    typeof baseExperimentId == "string",
                    "baseExperimentId should be a string"
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
                {allExperiments.map((experiment) => (
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
      {selectedBaseExperimentId && nonBaseExperiments.length > 0 && (
        <div css={css(fieldBaseCSS, selectCSS)}>
          <Label>comparisons</Label>
          <DialogTrigger>
            <Button size="S" trailingVisual={<SelectChevronUpDownIcon />}>
              {compareExperimentsDisplayText}
            </Button>
            <Popover placement="bottom start">
              <Dialog>
                <ListBox
                  selectionMode="multiple"
                  selectedKeys={new Set(selectedCompareExperimentIds)}
                  onSelectionChange={(keys) => {
                    onChange(
                      selectedBaseExperimentId,
                      Array.from(keys) as string[]
                    );
                  }}
                >
                  {nonBaseExperiments.map((experiment) => (
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
                              <Text
                                css={css`
                                  white-space: nowrap;
                                  max-width: var(
                                    --ac-global-dimension-size-2000
                                  );
                                  overflow: hidden;
                                  text-overflow: ellipsis;
                                `}
                              >
                                {experiment.name}
                              </Text>
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
      )}
    </Flex>
  );
}
