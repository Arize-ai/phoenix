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
  LinkButton,
  Menu,
  MenuContainer,
  MenuFooter,
  MenuHeader,
  MenuItem,
  MenuTrigger,
  SearchField,
  SearchIcon,
  SelectChevronUpDownIcon,
  Text,
  Token,
  View,
} from "@phoenix/components";
import { Truncate } from "@phoenix/components/utility/Truncate";

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

type LabelItem = {
  id: string;
  name: string;
  color: string;
};

type DatasetItem = {
  id: string;
  name: string;
  exampleCount: number;
  splits: SplitItem[];
  labels: LabelItem[];
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
        labels: dataset.labels.map((label) => ({
          id: label.id,
          name: label.name,
          color: label.color,
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
  const atLeastOneDatasetHasSplits = useMemo(
    () => datasetItems.some((dataset) => dataset.splits.length > 0),
    [datasetItems]
  );

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
      <MenuContainer>
        <Autocomplete filter={contains}>
          <MenuHeader>
            <SearchField aria-label="Search" autoFocus>
              <SearchIcon />
              <Input placeholder="Search datasets" />
            </SearchField>
          </MenuHeader>
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
              labels,
              isSelected,
              selectedSplitIds,
            }) => {
              const isDisabled = exampleCount === 0;
              const hasSplits = splits.length > 0;

              // If no splits, just select the dataset directly
              if (!hasSplits) {
                return (
                  <MenuItem
                    textValue={name}
                    isDisabled={isDisabled}
                    onAction={() => {
                      props.onSelectionChange?.({
                        datasetId: id,
                        splitIds: [],
                      });
                    }}
                  >
                    <Flex direction="column" gap="size-100" width="100%">
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
                          padding-right: ${atLeastOneDatasetHasSplits
                            ? "28px"
                            : undefined}; // right align the examples text if a submenu chevron is present
                        `}
                      >
                        <Text>{name}</Text>
                        <Text color="text-700" size="XS">
                          {exampleCount}{" "}
                          {exampleCount === 1 ? "example" : "examples"}
                        </Text>
                      </Flex>
                      {labels.length > 0 && (
                        <ul
                          css={css`
                            display: flex;
                            flex-direction: row;
                            gap: var(--ac-global-dimension-size-50);
                            min-width: 0;
                            flex-wrap: wrap;
                          `}
                        >
                          {labels.map((label) => (
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
                  </MenuItem>
                );
              }

              // If has splits, show submenu
              return (
                <SubmenuTrigger>
                  <MenuItem textValue={name} isDisabled={isDisabled}>
                    <Flex direction="column" gap="size-100" width="100%">
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
                      {labels.length > 0 && (
                        <ul
                          css={css`
                            display: flex;
                            flex-direction: row;
                            gap: var(--ac-global-dimension-size-50);
                            min-width: 0;
                            flex-wrap: wrap;
                          `}
                        >
                          {labels.map((label) => (
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
                  </MenuItem>
                  <MenuContainer placement="end top">
                    <Autocomplete filter={contains}>
                      <MenuHeader>
                        <SearchField aria-label="Search" autoFocus>
                          <Input placeholder="Search splits" />
                        </SearchField>
                      </MenuHeader>
                      <Menu
                        items={[
                          {
                            id: "all-examples",
                            name: "All examples",
                            isAllExamples: true,
                          },
                          ...splits.map((split) => ({
                            ...split,
                            isAllExamples: false,
                          })),
                        ]}
                        selectionMode="multiple"
                        selectedKeys={
                          isSelected && selectedSplitIds.length === 0
                            ? ["all-examples"]
                            : isSelected
                              ? selectedSplitIds
                              : []
                        }
                        onSelectionChange={(keys) => {
                          if (keys === "all") {
                            // Select all splits
                            props.onSelectionChange?.({
                              datasetId: id,
                              splitIds: splits.map((s) => s.id),
                            });
                          } else {
                            const newSelectedIds = Array.from(
                              keys as Set<string>
                            );
                            const prevSelectedIds =
                              selectedSplitIds.length === 0
                                ? ["all-examples"]
                                : selectedSplitIds;

                            const hasAllExamples =
                              newSelectedIds.includes("all-examples");
                            const splitSelections = newSelectedIds.filter(
                              (sid) => sid !== "all-examples"
                            );

                            // Check if "all-examples" was just clicked (added to selection)
                            const wasAllExamplesJustClicked =
                              hasAllExamples &&
                              !prevSelectedIds.includes("all-examples");

                            if (wasAllExamplesJustClicked) {
                              // User clicked "all-examples" - clear all split selections
                              props.onSelectionChange?.({
                                datasetId: id,
                                splitIds: [],
                              });
                            } else if (
                              hasAllExamples &&
                              splitSelections.length > 0
                            ) {
                              // User clicked a split while "all-examples" was selected
                              // Remove "all-examples" and keep only the splits
                              props.onSelectionChange?.({
                                datasetId: id,
                                splitIds: splitSelections,
                              });
                            } else if (
                              hasAllExamples &&
                              splitSelections.length === 0
                            ) {
                              // Only "all-examples" is selected
                              props.onSelectionChange?.({
                                datasetId: id,
                                splitIds: [],
                              });
                            } else if (
                              !hasAllExamples &&
                              splitSelections.length > 0
                            ) {
                              // Only splits are selected
                              props.onSelectionChange?.({
                                datasetId: id,
                                splitIds: splitSelections,
                              });
                            } else {
                              // Nothing selected - default to all examples
                              props.onSelectionChange?.({
                                datasetId: id,
                                splitIds: [],
                              });
                            }
                          }
                        }}
                      >
                        {({ id: itemId, name, isAllExamples }) => (
                          <MenuItem
                            id={itemId}
                            textValue={name}
                            css={
                              isAllExamples
                                ? css`
                                    border-bottom: 1px solid
                                      var(--ac-global-color-grey-200);
                                  `
                                : undefined
                            }
                          >
                            <Text>{name}</Text>
                          </MenuItem>
                        )}
                      </Menu>
                    </Autocomplete>
                  </MenuContainer>
                </SubmenuTrigger>
              );
            }}
          </Menu>
        </Autocomplete>
        <MenuFooter>
          <LinkButton to="/datasets" size="S" variant="quiet">
            Go to Datasets
          </LinkButton>
        </MenuFooter>
      </MenuContainer>
    </MenuTrigger>
  );
}
