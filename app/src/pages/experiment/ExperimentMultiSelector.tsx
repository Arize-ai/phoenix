import { useMemo } from "react";
import { graphql, useFragment } from "react-relay";
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

import { ExperimentMultiSelector__experiments$key } from "./__generated__/ExperimentMultiSelector__experiments.graphql";

export function ExperimentMultiSelector(props: {
  label: string;
  selectedExperimentIds: string[];
  onChange: (selectedExperimentIds: string[]) => void;
  dataset: ExperimentMultiSelector__experiments$key;
}) {
  const { dataset, selectedExperimentIds, onChange, label } = props;

  const data = useFragment(
    graphql`
      fragment ExperimentMultiSelector__experiments on Dataset {
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
    `,
    dataset
  );
  const experiments = useMemo(
    () =>
      data.experiments.edges.map((edge) => {
        return edge.experiment;
      }),
    [data]
  );
  const noExperiments = experiments.length === 0;
  const displayText = useMemo(() => {
    if (noExperiments) {
      return "No experiments";
    }
    const numExperiments = selectedExperimentIds.length;
    return numExperiments > 0
      ? `${numExperiments} experiment${numExperiments > 1 ? "s" : ""}`
      : "No experiments selected";
  }, [selectedExperimentIds, noExperiments]);

  // TODO: refactor to a multi-select component. See #8139
  return (
    <div css={css(fieldBaseCSS, selectCSS)}>
      <Label>{label}</Label>
      <DialogTrigger>
        <Button
          isDisabled={noExperiments}
          size="M"
          trailingVisual={<SelectChevronUpDownIcon />}
        >
          {displayText}
        </Button>
        <Popover placement="bottom start">
          <Dialog>
            <ListBox
              selectionMode="multiple"
              selectedKeys={new Set(selectedExperimentIds)}
              onSelectionChange={(keys) => {
                if (keys === "all") {
                  onChange(experiments.map((exp) => exp.id));
                } else {
                  onChange(Array.from(keys) as string[]);
                }
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
  );
}
