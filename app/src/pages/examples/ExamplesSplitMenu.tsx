import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { graphql, useLazyLoadQuery, useMutation } from "react-relay";
import { css } from "@emotion/react";

import {
  Autocomplete,
  Button,
  Checkbox,
  Flex,
  Heading,
  Icon,
  IconButton,
  Icons,
  Input,
  Loading,
  Menu,
  MenuItem,
  MenuTrigger,
  Popover,
  SearchField,
  Token,
  useFilter,
  View,
} from "@phoenix/components";
import { NewDatasetSplitForm } from "@phoenix/components/datasetSplit/NewDatasetSplitForm";
import { useDatasetSplitMutations } from "@phoenix/components/datasetSplit/useDatasetSplitMutations";
import { ExamplesSplitMenuQuery } from "@phoenix/pages/examples/__generated__/ExamplesSplitMenuQuery.graphql";
import { ExamplesCache } from "@phoenix/pages/examples/ExamplesFilterContext";
import { Mutable } from "@phoenix/typeUtils";

type ExamplesSplitMenuProps = {
  onSelectionChange: (splitIds: string[]) => void;
  onExampleSelectionChange: (exampleIds: string[]) => void;
  selectedSplitIds: string[];
  selectedExampleIds: string[];
  examplesCache: ExamplesCache;
};

const getInitialMode = (selectedExampleIds: string[]) => {
  if (selectedExampleIds.length > 0) {
    return "apply";
  } else {
    return "filter";
  }
};

export const ExamplesSplitMenu = ({
  onSelectionChange,
  onExampleSelectionChange,
  selectedSplitIds,
  selectedExampleIds,
  examplesCache,
}: ExamplesSplitMenuProps) => {
  const [mode, setMode] = useState<"filter" | "apply" | "create">(() =>
    getInitialMode(selectedExampleIds)
  );
  useEffect(() => {
    setMode(getInitialMode(selectedExampleIds));
  }, [selectedExampleIds]);
  const dynamicOnSelectionChange = useCallback(
    (splitIds: string[]) => {
      if (selectedExampleIds.length > 0) {
        onExampleSelectionChange([]);
        onSelectionChange(splitIds);
      } else {
        onSelectionChange(splitIds);
      }
    },
    [onSelectionChange, onExampleSelectionChange, selectedExampleIds]
  );
  const selectedPartialExamples = useMemo(() => {
    return selectedExampleIds.map((id) => examplesCache[id]).filter(Boolean);
  }, [selectedExampleIds, examplesCache]);

  return (
    <MenuTrigger
      onOpenChange={(open) => {
        if (!open) {
          setMode(getInitialMode(selectedExampleIds));
        }
      }}
    >
      <Button leadingVisual={<Icon svg={<Icons.PriceTagsOutline />} />}>
        Splits
      </Button>
      <Popover>
        <Suspense
          fallback={
            <Loading
              css={css`
                min-width: 300px;
              `}
            />
          }
        >
          {(mode === "filter" || mode === "apply") && (
            <SplitMenu
              selectedSplitIds={selectedSplitIds}
              onSelectionChange={dynamicOnSelectionChange}
              selectedExampleIds={selectedExampleIds}
              onExampleSelectionChange={onExampleSelectionChange}
              selectedPartialExamples={selectedPartialExamples}
              setMode={setMode}
            />
          )}
          {mode === "create" && (
            <SplitMenuCreateContent
              setMode={setMode}
              selectedExampleIds={selectedExampleIds}
            />
          )}
        </Suspense>
      </Popover>
    </MenuTrigger>
  );
};

const SplitMenu = ({
  selectedSplitIds,
  selectedExampleIds,
  onSelectionChange,
  selectedPartialExamples,
  setMode,
}: {
  selectedSplitIds: string[];
  selectedExampleIds: string[];
  onSelectionChange: (splitIds: string[]) => void;
  onExampleSelectionChange: (exampleIds: string[]) => void;
  selectedPartialExamples: {
    id: string;
    datasetSplits: { id: string; name: string }[];
  }[];
  setMode: (mode: "filter" | "apply" | "create") => void;
}) => {
  const { contains } = useFilter({ sensitivity: "base" });
  const data = useLazyLoadQuery<ExamplesSplitMenuQuery>(
    graphql`
      query ExamplesSplitMenuQuery {
        datasetSplits {
          edges {
            split: node {
              id
              name
              color
            }
          }
        }
      }
    `,
    {},
    // refetch every time the menu is opened
    { fetchPolicy: "network-only" }
  );
  const [addExamplesToSplits] = useMutation(graphql`
    mutation ExamplesSplitMenuAddDatasetExamplesToDatasetSplitsMutation(
      $input: AddDatasetExamplesToDatasetSplitsInput!
    ) {
      addDatasetExamplesToDatasetSplits(input: $input) {
        examples {
          id
          datasetSplits {
            id
            name
            color
          }
        }
      }
    }
  `);
  const [removeExamplesFromSplit] = useMutation(graphql`
    mutation ExamplesSplitMenuRemoveDatasetExamplesFromDatasetSplitMutation(
      $input: RemoveDatasetExamplesFromDatasetSplitsInput!
    ) {
      removeDatasetExamplesFromDatasetSplits(input: $input) {
        examples {
          id
          datasetSplits {
            id
            name
            color
          }
        }
      }
    }
  `);
  const onUpdateSplits = useCallback(
    (changes: {
      selectedExampleIds: string[];
      addSplitIds?: string[];
      removeSplitIds?: string[];
    }) => {
      if (changes.addSplitIds) {
        addExamplesToSplits({
          variables: {
            input: {
              exampleIds: changes.selectedExampleIds,
              datasetSplitIds: changes.addSplitIds,
            },
          },
        });
      }
      if (changes.removeSplitIds) {
        removeExamplesFromSplit({
          variables: {
            input: {
              exampleIds: changes.selectedExampleIds,
              datasetSplitIds: changes.removeSplitIds,
            },
          },
        });
      }
    },
    [addExamplesToSplits, removeExamplesFromSplit]
  );
  const splits = useMemo(() => {
    return data.datasetSplits.edges.map((edge) => edge.split);
  }, [data]);
  return (
    <Autocomplete filter={contains}>
      <View
        padding="size-200"
        paddingTop="size-100"
        borderBottomWidth="thin"
        borderColor="dark"
        minWidth={300}
      >
        <Flex direction="column" gap="size-100">
          <Flex
            direction="row"
            justifyContent="space-between"
            alignItems="center"
          >
            <Heading level={4} weight="heavy">
              {selectedExampleIds.length > 0
                ? "Apply splits to selected examples"
                : "Filter examples by splits"}
            </Heading>
            <IconButton
              size="S"
              onPress={() => {
                setMode("create");
              }}
            >
              <Icon svg={<Icons.PlusOutline />} />
            </IconButton>
          </Flex>
          <SearchField aria-label="Search" autoFocus>
            <Input placeholder="Search splits" />
          </SearchField>
        </Flex>
      </View>
      {selectedExampleIds.length === 0 ? (
        <SplitMenuFilterContent
          selectedSplitIds={selectedSplitIds}
          onSelectionChange={onSelectionChange}
          splits={splits as Mutable<typeof splits>}
        />
      ) : (
        <SplitMenuApplyContent
          onSelectionChange={onUpdateSplits}
          splits={splits as Mutable<typeof splits>}
          selectedPartialExamples={selectedPartialExamples}
        />
      )}
    </Autocomplete>
  );
};

/**
 * When the SplitMenu is in filter mode, display a simple multi-select menu of splits.
 */
const SplitMenuFilterContent = ({
  selectedSplitIds,
  onSelectionChange,
  splits,
}: {
  selectedSplitIds: string[];
  onSelectionChange: (splitIds: string[]) => void;
  splits: { id: string; name: string; color: string }[];
}) => {
  return (
    <Menu
      items={splits}
      selectionMode="multiple"
      renderEmptyState={() => "No splits found"}
      selectedKeys={selectedSplitIds}
      onSelectionChange={(keys) => {
        if (keys === "all") {
          onSelectionChange(splits.map((s) => s.id));
        } else {
          onSelectionChange(Array.from(keys as Set<string>));
        }
      }}
    >
      {({ id, name, color }) => (
        <MenuItem id={id} textValue={name}>
          <Token color={color}>{name}</Token>
        </MenuItem>
      )}
    </Menu>
  );
};

/**
 * When the SplitMenu is in apply mode, we display a semi-custom menu with the following attributes:
 * Display:
 * - All splits are shown and filterable, with a checkbox beside each split.
 * - Any split that is contained within every selected example is checked
 * - Any split that is contained within some but not all selected examples is indeterminate
 * - Any split that is not contained within any selected example is unchecked
 * Behavior:
 * - When a checked split is selected/clicked, remove that split from all selected examples
 * - When an indeterminate split is selected/clicked, add that split to all selected examples
 * - When an unchecked split is selected/clicked, add that split to all selected examples
 */
const SplitMenuApplyContent = ({
  onSelectionChange,
  splits,
  selectedPartialExamples,
}: {
  onSelectionChange: (changes: {
    selectedExampleIds: string[];
    addSplitIds?: string[];
    removeSplitIds?: string[];
  }) => void;
  splits: { id: string; name: string; color: string }[];
  selectedPartialExamples: {
    id: string;
    datasetSplits: { id: string; name: string }[];
  }[];
}) => {
  // derive checkbox states for each split based on the selectedPartialExamples
  type SplitState = Record<string, "checked" | "indeterminate" | "unchecked">;
  const splitStates: SplitState = useMemo(() => {
    return splits.reduce((acc, split) => {
      acc[split.id] = "unchecked";
      // if split id is is some selected example, set to indeterminate
      if (
        selectedPartialExamples.some((example) =>
          example.datasetSplits.some((s) => s.id === split.id)
        )
      ) {
        acc[split.id] = "indeterminate";
      }
      // if split id is is every selected example, set to checked
      if (
        selectedPartialExamples.every((example) =>
          example.datasetSplits.some((s) => s.id === split.id)
        )
      ) {
        acc[split.id] = "checked";
      }

      return acc;
    }, {} as SplitState);
  }, [splits, selectedPartialExamples]);
  return (
    <Menu
      items={splits}
      renderEmptyState={() => "No splits found"}
      selectedKeys={[]}
      selectionMode="multiple"
      // ensure that menu items are re-rendered when splitStates changes
      dependencies={[splitStates]}
    >
      {({ id, name, color }) => (
        <MenuItem id={id} textValue={name}>
          <Flex alignItems="center" gap="size-200">
            <Checkbox
              isSelected={splitStates[id] === "checked"}
              isIndeterminate={splitStates[id] === "indeterminate"}
              onChange={(checked) => {
                if (checked) {
                  onSelectionChange({
                    selectedExampleIds: selectedPartialExamples.map(
                      (e) => e.id
                    ),
                    addSplitIds: [id],
                  });
                } else {
                  onSelectionChange({
                    selectedExampleIds: selectedPartialExamples.map(
                      (e) => e.id
                    ),
                    removeSplitIds: [id],
                  });
                }
              }}
            />
            <Token color={color}>{name}</Token>
          </Flex>
        </MenuItem>
      )}
    </Menu>
  );
};

const SplitMenuCreateContent = ({
  setMode,
  selectedExampleIds,
}: {
  setMode: (mode: "filter" | "apply" | "create") => void;
  selectedExampleIds: string[];
}) => {
  const onCompleted = useCallback(() => {
    if (selectedExampleIds.length > 0) {
      setMode("apply");
    } else {
      setMode("filter");
    }
  }, [setMode, selectedExampleIds]);
  const { onSubmit, isCreatingDatasetSplit } = useDatasetSplitMutations({
    exampleIds: selectedExampleIds,
    onCompleted,
  });
  return (
    <Flex direction="column">
      <View
        padding="size-100"
        paddingTop="size-100"
        borderBottomWidth="thin"
        borderColor="dark"
        minWidth={300}
      >
        <Flex gap="size-100" alignItems="center">
          <IconButton onPress={() => setMode("filter")} size="S">
            <Icon svg={<Icons.ChevronLeft />} />
          </IconButton>
          <Heading level={4} weight="heavy">
            Create Split
            {selectedExampleIds.length > 0
              ? " for " + selectedExampleIds.length + " examples"
              : ""}
          </Heading>
        </Flex>
      </View>
      <View maxWidth={300}>
        <NewDatasetSplitForm
          onSubmit={onSubmit}
          isSubmitting={isCreatingDatasetSplit}
        />
      </View>
    </Flex>
  );
};
