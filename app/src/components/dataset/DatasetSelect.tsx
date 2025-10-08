import { useMemo } from "react";
import {
  Autocomplete,
  Input,
  SubmenuTrigger,
  useFilter,
} from "react-aria-components";
import { graphql, useLazyLoadQuery } from "react-relay";
import { css } from "@emotion/react";

import {
  Button,
  Flex,
  LazyTabPanel,
  Menu,
  MenuItem,
  MenuTrigger,
  Popover,
  SearchField,
  SelectChevronUpDownIcon,
  Tab,
  TabList,
  Tabs,
  Text,
  View,
} from "@phoenix/components";

import { DatasetSelectQuery } from "./__generated__/DatasetSelectQuery.graphql";

type DatasetSelectProps = {
  onSelectionChange?: (changes: {
    datasetId: string | null;
    splitIds: string[];
  }) => void;
  value?: {
    datasetId: string | null;
    splitIds: string[];
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
  const { datasetId, splitIds = [] } = props.value || {};
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

  const { contains } = useFilter({ sensitivity: "base" });

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

  const selectedSplits = useMemo(() => {
    if (selectedDataset && splitIds.length > 0) {
      return selectedDataset.splits.filter((split) =>
        splitIds.includes(split.id)
      );
    }
    return [];
  }, [selectedDataset, splitIds]);

  const selectedDatasetKeys = datasetId ? [datasetId] : undefined;
  const selectedSplitKeys = splitIds.length > 0 ? splitIds : undefined;

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
            {selectedSplits.length > 0 ? (
              <Text color="text-300">
                &nbsp;/{" "}
                {selectedSplits.length === 1
                  ? selectedSplits[0].name
                  : `${selectedSplits.length} splits`}
              </Text>
            ) : (
              <Text color="text-300">&nbsp;/ All Examples</Text>
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
        <Autocomplete filter={contains}>
          <View paddingX="size-100" marginTop="size-100">
            <SearchField aria-label="Search" autoFocus>
              <Input placeholder="Search datasets" />
            </SearchField>
          </View>
          <Menu
            selectionMode="single"
            selectedKeys={selectedDatasetKeys}
            items={datasetItems}
            renderEmptyState={() => "No datasets found"}
          >
            {function renderMenuItem({ id, name, exampleCount, splits }) {
              return (
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
                    <View width="100%">
                      <Tabs
                        defaultSelectedKey={
                          selectedSplits.length > 0 ? "splits" : "all-examples"
                        }
                      >
                        <TabList>
                          <Tab id="all-examples">All Examples</Tab>
                          <Tab id="splits">Splits</Tab>
                        </TabList>
                        <LazyTabPanel id="all-examples">
                          <Menu
                            items={[
                              { id: "all-examples", label: "All Examples" },
                            ]}
                            selectionMode="single"
                            onSelectionChange={() => {
                              props.onSelectionChange?.({
                                datasetId: id,
                                splitIds: [],
                              });
                            }}
                          >
                            {() => (
                              <MenuItem textValue="All Examples">
                                <Text>Use all {exampleCount} examples</Text>
                              </MenuItem>
                            )}
                          </Menu>
                        </LazyTabPanel>
                        <LazyTabPanel id="splits">
                          <Autocomplete filter={contains}>
                            <View paddingX="size-100" marginTop="size-100">
                              <SearchField aria-label="Search" autoFocus>
                                <Input placeholder="Search splits" />
                              </SearchField>
                            </View>
                            <Menu
                              items={splits}
                              renderEmptyState={() => (
                                <View padding="size-200">
                                  <Text color="text-700">No splits found</Text>
                                </View>
                              )}
                              selectionMode="multiple"
                              selectedKeys={
                                selectedDataset?.id === id
                                  ? selectedSplitKeys
                                  : undefined
                              }
                              onSelectionChange={(keys) => {
                                if (keys === "all") {
                                  // Select all splits
                                  props.onSelectionChange?.({
                                    datasetId: id,
                                    splitIds: splits.map((s) => s.id),
                                  });
                                } else {
                                  const selectedIds = Array.from(
                                    keys as Set<string>
                                  );
                                  props.onSelectionChange?.({
                                    datasetId: id,
                                    splitIds: selectedIds,
                                  });
                                }
                              }}
                            >
                              {({ id: splitId, name }) => (
                                <MenuItem id={splitId} textValue={name}>
                                  {name}
                                </MenuItem>
                              )}
                            </Menu>
                          </Autocomplete>
                        </LazyTabPanel>
                      </Tabs>
                    </View>
                  </Popover>
                </SubmenuTrigger>
              );
            }}
          </Menu>
        </Autocomplete>
      </Popover>
    </MenuTrigger>
  );
}
