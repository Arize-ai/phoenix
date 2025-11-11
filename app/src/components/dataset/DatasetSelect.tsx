import { graphql, useLazyLoadQuery } from "react-relay";
import { css } from "@emotion/react";

import {
  Button,
  Flex,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Select,
  SelectChevronUpDownIcon,
  SelectItem,
  SelectValue,
  Text,
  Token,
} from "@phoenix/components";
import { Truncate } from "@phoenix/components/utility/Truncate";

import { DatasetSelectQuery } from "./__generated__/DatasetSelectQuery.graphql";

type DatasetSelectProps = {
  onChange?: (key: string) => void;
  onBlur?: () => void;
  validationState?: "valid" | "invalid";
  errorMessage?: string;
  value?: string | null;
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
              labels {
                id
                name
                color
              }
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
      onChange={(key) => {
        if (key) {
          props.onChange?.(key.toString());
        }
      }}
      placeholder={props.placeholder ?? "Select a dataset"}
      onBlur={props.onBlur}
      isRequired={props.isRequired}
      value={props.value}
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
            return (
              <SelectItem key={dataset.id} id={dataset.id}>
                <Flex direction="column" gap="size-100" width="100%">
                  <Flex
                    direction="row"
                    alignItems="center"
                    gap="size-200"
                    justifyContent="space-between"
                    width="100%"
                  >
                    <Text>{dataset.name}</Text>
                    <Text color="text-700" size="XS">
                      {dataset.exampleCount} examples
                    </Text>
                  </Flex>
                  {dataset.labels.length > 0 && (
                    <ul
                      css={css`
                        display: flex;
                        flex-direction: row;
                        gap: var(--ac-global-dimension-size-50);
                        min-width: 0;
                        flex-wrap: wrap;
                      `}
                    >
                      {dataset.labels.map((label) => (
                        <li key={label.id}>
                          <Token color={label.color}>
                            <Truncate maxWidth={150} title={label.name}>
                              {label.name}
                            </Truncate>
                          </Token>
                        </li>
                      ))}
                    </ul>
                  )}
                </Flex>
              </SelectItem>
            );
          })}
          <ListBoxItem
            href="/datasets"
            style={{
              textDecoration: "none",
            }}
          >
            Go to Datasets
          </ListBoxItem>
        </ListBox>
      </Popover>
    </Select>
  );
}
