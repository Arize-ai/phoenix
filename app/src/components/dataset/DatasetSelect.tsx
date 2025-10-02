import { useMemo } from "react";
import { SubmenuTrigger } from "react-aria-components";
import { graphql, useLazyLoadQuery } from "react-relay";
import { css } from "@emotion/react";

import {
  Button,
  Flex,
  Menu,
  MenuItem,
  MenuTrigger,
  Popover,
  SelectChevronUpDownIcon,
  Text,
} from "@phoenix/components";

import { DatasetSelectQuery } from "./__generated__/DatasetSelectQuery.graphql";

type DatasetSelectProps = {
  onSelectionChange?: (changes: {
    datasetId: string | null;
    splitId: string | null;
  }) => void;
  value?: {
    datasetId: string | null;
    splitId: string | null;
  } | null;
  onBlur?: () => void;
  validationState?: "valid" | "invalid";
  errorMessage?: string;
  placeholder?: string;
  size?: "S" | "M";
  label?: string;
  isRequired?: boolean;
};

type SplitItem = {
  id: string;
  name: string;
};

type DatasetItem = {
  id: string;
  name: string;
  exampleCount: number;
  splits: SplitItem[];
};

export function DatasetSelect(props: DatasetSelectProps) {
  const { datasetId, splitId } = props.value || {};
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
              splits {
                id
                name
              }
            }
          }
        }
      }
    `,
    {},
    { fetchPolicy: "store-and-network" }
  );

  const datasetItems: DatasetItem[] = useMemo(
    () =>
      data.datasets.edges.map(({ dataset }) => ({
        id: dataset.id,
        name: dataset.name,
        exampleCount: dataset.exampleCount,
        splits: dataset.splits.map((split) => ({
          id: split.id,
          name: split.name,
        })),
      })),
    [data.datasets.edges]
  );

  const selectedDataset = useMemo(() => {
    if (datasetId) {
      return datasetItems.find((dataset) => dataset.id === datasetId);
    }
    return undefined;
  }, [datasetItems, datasetId]);

  const selectedSplit = useMemo(() => {
    if (selectedDataset && splitId) {
      return selectedDataset.splits.find((split) => split.id === splitId);
    }
    return undefined;
  }, [selectedDataset, splitId]);

  const selectedDatasetKeys = datasetId ? [datasetId] : undefined;
  const selectedSplitKeys = splitId ? [splitId] : undefined;

  return (
    <MenuTrigger>
      <Button
        data-testid="dataset-picker"
        className="dataset-picker-button"
        trailingVisual={<SelectChevronUpDownIcon />}
        size={props.size ?? "S"}
      >
        {selectedDataset ? (
          <Flex alignItems="center">
            <Text>{selectedDataset.name}</Text>
            {selectedSplit && (
              <Text color="text-300">&nbsp;/ {selectedSplit.name}</Text>
            )}
          </Flex>
        ) : (
          <Text color="text-300">
            {props.placeholder ?? "Select a dataset"}
          </Text>
        )}
      </Button>
      <Popover
        css={css`
          overflow: auto;
        `}
      >
        <Menu
          selectionMode="single"
          selectedKeys={selectedDatasetKeys}
          items={datasetItems}
          renderEmptyState={() => "No datasets found"}
        >
          {({ id, name, exampleCount, splits }) => (
            <SubmenuTrigger>
              <MenuItem textValue={name}>
                <Flex
                  direction="row"
                  alignItems="center"
                  gap="size-200"
                  justifyContent="space-between"
                  width="100%"
                >
                  <Text>{name}</Text>
                  <Text color="text-700" size="XS">
                    {exampleCount} examples
                  </Text>
                </Flex>
              </MenuItem>
              <Popover
                css={css`
                  overflow: auto;
                `}
              >
                <Menu
                  items={splits}
                  renderEmptyState={() => "No splits found"}
                  selectionMode="single"
                  selectedKeys={
                    selectedDataset?.id === id ? selectedSplitKeys : undefined
                  }
                  onSelectionChange={(keys) => {
                    const newSelection =
                      keys instanceof Set ? keys.values().next().value : null;
                    props.onSelectionChange?.(
                      newSelection == null
                        ? {
                            datasetId: null,
                            splitId: null,
                          }
                        : {
                            datasetId: id,
                            splitId: newSelection as string,
                          }
                    );
                  }}
                >
                  {({ name }) => <MenuItem textValue={name}>{name}</MenuItem>}
                </Menu>
              </Popover>
            </SubmenuTrigger>
          )}
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}
