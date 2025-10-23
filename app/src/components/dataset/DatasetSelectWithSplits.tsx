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
  LinkButton,
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

import { DatasetSelectWithSplitsQuery } from "./__generated__/DatasetSelectWithSplitsQuery.graphql";

type DatasetSelectWithSplitsProps = {
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
  isSelected: boolean;
  selectedSplitIds: string[];
};

export function DatasetSelectWithSplits(props: DatasetSelectWithSplitsProps) {
  const { datasetId, splitIds = [] } = props.value || {};
  const data = useLazyLoadQuery<DatasetSelectWithSplitsQuery>(
    graphql`
      query DatasetSelectWithSplitsQuery {
        datasets(after: null, first: 100)
          @connection(key: "DatasetPickerWithSplits__datasets") {
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
        isSelected: dataset.id === datasetId,
        selectedSplitIds: dataset.id === datasetId ? splitIds : [],
      })),
    [data, datasetId, splitIds]
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
            renderEmptyState={() => (
              <View padding="size-100">
                <Text color="grey-300" size="S">
                  No datasets found
                </Text>
              </View>
            )}
          >
            {({
              id,
              name,
              exampleCount,
              splits,
              isSelected,
              selectedSplitIds,
            }) => {
              const isDisabled = exampleCount === 0;
              return (
                <SubmenuTrigger>
                  <MenuItem textValue={name} isDisabled={isDisabled}>
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
                      <Text>{name}</Text>
                      <Text color="text-700" size="XS">
                        {exampleCount}{" "}
                        {exampleCount === 1 ? "example" : "examples"}
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
                          selectedSplitIds.length > 0
                            ? "splits"
                            : "all-examples"
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
                                <Text>
                                  Use{" "}
                                  {exampleCount === 1
                                    ? `${exampleCount} example`
                                    : `all ${exampleCount} examples`}
                                </Text>
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
                              selectedKeys={isSelected ? selectedSplitIds : []}
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
        <View padding="size-150" borderTopColor="light" borderTopWidth="thin">
          <LinkButton to="/datasets" variant="quiet" size="S">
            Go to datasets
          </LinkButton>
        </View>
      </Popover>
    </MenuTrigger>
  );
}
