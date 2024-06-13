import React, { useMemo } from "react";
import { graphql, useFragment } from "react-relay";

import {
  Dropdown,
  DropdownProps,
  Field,
  FieldProps,
  Flex,
  Item,
  Label,
  ListBox,
  Text,
} from "@arizeai/components";

import { ExperimentMultiSelector__experiments$key } from "./__generated__/ExperimentMultiSelector__experiments.graphql";

export function ExperimentMultiSelector(
  props: Omit<DropdownProps, "menu" | "children"> &
    Pick<
      FieldProps,
      "label" | "validationState" | "description" | "errorMessage"
    > & {
      label: string;
      selectedExperimentIds: string[];
      onChange: (selectedExperimentIds: string[]) => void;
      dataset: ExperimentMultiSelector__experiments$key;
    }
) {
  const {
    dataset,
    selectedExperimentIds,
    onChange,
    label,
    validationState,
    description,
    errorMessage,
    ...restProps
  } = props;
  const data = useFragment(
    graphql`
      fragment ExperimentMultiSelector__experiments on Dataset {
        experiments {
          edges {
            experiment: node {
              id
              sequenceNumber
              description
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
  const noColumns = experiments.length === 0;
  const displayText = useMemo(() => {
    if (noColumns) {
      return "No experiments";
    }
    const numExperiments = selectedExperimentIds.length;
    return numExperiments > 0
      ? `${numExperiments} experiment${numExperiments > 1 ? "s" : ""}`
      : "No experiments selected";
  }, [selectedExperimentIds, noColumns]);
  return (
    <Field
      label={label}
      isDisabled={noColumns}
      validationState={validationState}
      description={description}
      errorMessage={errorMessage}
    >
      <Dropdown
        isDisabled={noColumns}
        {...restProps}
        menu={
          <ListBox
            selectionMode="multiple"
            onSelectionChange={(keys) => {
              onChange(Array.from(keys) as string[]);
            }}
            selectedKeys={new Set(selectedExperimentIds)}
          >
            {experiments.map((experiment) => (
              <Item key={experiment.id}>
                <Flex direction="column" gap="size-50">
                  <Flex direction="row" gap="size-100">
                    <Label color="yellow-1000">
                      #{experiment.sequenceNumber}
                    </Label>
                    <Text>
                      {new Date(experiment.createdAt).toLocaleDateString()}
                    </Text>
                  </Flex>
                  <Text textSize="small" color="text-700">
                    {experiment.description || "no description"}
                  </Text>
                </Flex>
              </Item>
            ))}
          </ListBox>
        }
        triggerProps={{
          placement: "bottom start",
        }}
      >
        {displayText}
      </Dropdown>
    </Field>
  );
}
