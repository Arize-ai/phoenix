import React from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { Item, Picker, PickerProps } from "@arizeai/components";

import { DatasetPickerQuery } from "./__generated__/DatasetPickerQuery.graphql";

type DatasetPickerProps = Pick<
  PickerProps<string>,
  | "onSelectionChange"
  | "onBlur"
  | "validationState"
  | "errorMessage"
  | "selectedKey"
  | "placeholder"
  | "size"
  | "label"
>;

export function DatasetPicker(props: DatasetPickerProps) {
  const data = useLazyLoadQuery<DatasetPickerQuery>(
    graphql`
      query DatasetPickerQuery {
        datasets(after: null, first: 100)
          @connection(key: "DatasetPicker__datasets") {
          edges {
            dataset: node {
              id
              name
            }
          }
        }
      }
    `,
    {},
    { fetchPolicy: "store-and-network" }
  );
  return (
    <Picker
      label={props.label}
      data-testid="dataset-picker"
      size={props.size}
      className="dataset-picker"
      aria-label={`select a dataset`}
      onSelectionChange={props.onSelectionChange}
      placeholder={props.placeholder ?? "Select a dataset"}
      onBlur={props.onBlur}
      isRequired
      validationState={props.validationState}
      errorMessage={props.errorMessage}
      selectedKey={props.selectedKey}
    >
      {data.datasets.edges.map(({ dataset }) => (
        <Item key={dataset.id} aria-label={dataset.name}>
          {dataset.name}
        </Item>
      ))}
    </Picker>
  );
}
