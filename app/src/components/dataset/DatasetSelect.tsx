import { graphql, useLazyLoadQuery } from "react-relay";
import { css } from "@emotion/react";

import {
  Button,
  Flex,
  Label,
  LinkButton,
  ListBox,
  Popover,
  Select,
  SelectChevronUpDownIcon,
  SelectItem,
  SelectValue,
  Text,
  View,
} from "@phoenix/components";

import { DatasetSelectQuery } from "./__generated__/DatasetSelectQuery.graphql";

type DatasetSelectProps = {
  onSelectionChange?: (key: string) => void;
  onBlur?: () => void;
  validationState?: "valid" | "invalid";
  errorMessage?: string;
  selectedKey?: string | null;
  placeholder?: string;
  size?: "S" | "M";
  label?: string;
  isRequired?: boolean;
};

export function DatasetSelect(props: DatasetSelectProps) {
  const data = useLazyLoadQuery<DatasetSelectQuery>(
    graphql`
      query DatasetSelectQuery {
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
    <Select
      data-testid="dataset-picker"
      size={props.size}
      className="dataset-picker"
      aria-label={`select a dataset`}
      onSelectionChange={(key) => {
        if (key) {
          props.onSelectionChange?.(key.toString());
        }
      }}
      placeholder={props.placeholder ?? "Select a dataset"}
      onBlur={props.onBlur}
      isRequired={props.isRequired}
      selectedKey={props.selectedKey}
    >
      {props.label && <Label>{props.label}</Label>}
      <Button className="dataset-picker-button">
        <SelectValue />
        <SelectChevronUpDownIcon />
      </Button>
      {props.errorMessage && (
        <Text slot="errorMessage">{props.errorMessage}</Text>
      )}
      <Popover>
        <ListBox
          css={css`
            min-height: auto;
          `}
        >
          {data.datasets.edges.map(({ dataset }) => {
            const isDisabled = dataset.exampleCount === 0;
            return (
              <SelectItem
                key={dataset.id}
                id={dataset.id}
                isDisabled={isDisabled}
              >
                <Flex
                  direction="row"
                  alignItems="center"
                  gap="size-200"
                  justifyContent="space-between"
                  width="100%"
                  css={css`
                    opacity: ${isDisabled
                      ? "var(--ac-global-opacity-disabled)"
                      : 1};
                  `}
                >
                  <Text>{dataset.name}</Text>
                  <Text color="text-700" size="XS">
                    {dataset.exampleCount} examples
                  </Text>
                </Flex>
              </SelectItem>
            );
          })}
        </ListBox>
        <View padding="size-50" borderTopColor="light" borderTopWidth="thin">
          <LinkButton to="/datasets" variant="quiet" size="S">
            Go to datasets
          </LinkButton>
        </View>
      </Popover>
    </Select>
  );
}
