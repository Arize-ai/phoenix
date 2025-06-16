import { useMemo } from "react";
import { graphql, useFragment } from "react-relay";

import {
  Button,
  Flex,
  Icon,
  Icons,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Select,
  SelectChevronUpDownIcon,
  SelectValue,
  Text,
} from "@phoenix/components";
import { SequenceNumberToken } from "@phoenix/components/experiment/SequenceNumberToken";

import { ExperimentMultiSelector__experiments$key } from "./__generated__/ExperimentMultiSelector__experiments.graphql";

export function ExperimentMultiSelector(props: {
  label: string;
  selectedExperimentIds: string[];
  onChange: (selectedExperimentIds: string[]) => void;
  dataset: ExperimentMultiSelector__experiments$key;
  size?: "S" | "M";
  isDisabled?: boolean;
  validationState?: "valid" | "invalid";
  description?: string;
  errorMessage?: string;
}) {
  const {
    dataset,
    selectedExperimentIds,
    onChange,
    label,
    size = "M",
    isDisabled,
    validationState,
    description,
    errorMessage,
  } = props;
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

  return (
    <Select
      aria-label={label}
      isDisabled={noExperiments || isDisabled}
      size={size}
      // For multi-select, we don't use selectedKey, the selection is managed by the ListBox
      placeholder={displayText}
    >
      <Label>{label}</Label>
      <Button>
        <SelectValue>
          {({ isPlaceholder: _isPlaceholder }) => {
            return displayText;
          }}
        </SelectValue>
        <SelectChevronUpDownIcon />
      </Button>
      {description && <Text slot="description">{description}</Text>}
      {errorMessage && validationState === "invalid" && (
        <Text slot="errorMessage">{errorMessage}</Text>
      )}
      <Popover placement="bottom start">
        <ListBox
          selectionMode="multiple"
          onSelectionChange={(keys) => {
            onChange(Array.from(keys) as string[]);
          }}
          selectedKeys={new Set(selectedExperimentIds)}
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
      </Popover>
    </Select>
  );
}
