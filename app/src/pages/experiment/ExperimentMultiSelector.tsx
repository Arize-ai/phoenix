import React, { useMemo } from "react";

import {
  Dropdown,
  DropdownProps,
  Field,
  FieldProps,
  Item,
  ListBox,
} from "@arizeai/components";

export function ExperimentMultiSelector(
  props: Omit<DropdownProps, "menu" | "children"> &
    Pick<
      FieldProps,
      "label" | "validationState" | "description" | "errorMessage"
    > & {
      label: string;
      experiments: string[];
      selectedExperimentIds: string[];
      onChange: (selectedColumns: string[]) => void;
    }
) {
  const {
    experiments,
    selectedExperimentIds,
    onChange,
    label,
    validationState,
    description,
    errorMessage,
    ...restProps
  } = props;
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
            {experiments.map((column) => (
              <Item key={column}>{column}</Item>
            ))}
          </ListBox>
        }
        triggerProps={{
          placement: "bottom end",
        }}
      >
        {displayText}
      </Dropdown>
    </Field>
  );
}
