import { graphql, useLazyLoadQuery } from "react-relay";

import { Item, Picker, PickerProps } from "@arizeai/components";

import { Flex, Text } from "@phoenix/components";

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
              exampleCount
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
          <Flex
            direction="column"
            justifyContent={"space-between"}
            width={"100%"}
          >
            <Text>{dataset.name}</Text>
            <Text color="text-700" size="XS">
              {dataset.exampleCount} examples
            </Text>
          </Flex>
        </Item>
      ))}
    </Picker>
  );
}
