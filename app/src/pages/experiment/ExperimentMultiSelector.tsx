import { useMemo } from "react";
import { graphql, useFragment } from "react-relay";

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
    <div
      className={`ac-field ${validationState === "invalid" ? "ac-field--invalid" : ""}`}
    >
      <Label>{label}</Label>
      <DialogTrigger>
        <Button
          isDisabled={noExperiments || isDisabled}
          size={size}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            minWidth: "150px",
            width: "fit-content",
          }}
        >
          <span>{displayText}</span>
          <SelectChevronUpDownIcon />
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
      {description && <Text slot="description">{description}</Text>}
      {errorMessage && validationState === "invalid" && (
        <Text slot="errorMessage">{errorMessage}</Text>
      )}
    </div>
  );
}
