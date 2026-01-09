import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { graphql, useLazyLoadQuery, useMutation } from "react-relay";

import {
  Autocomplete,
  Button,
  ButtonProps,
  Checkbox,
  Flex,
  Icon,
  IconButton,
  Icons,
  Input,
  Loading,
  Menu,
  MenuContainer,
  MenuHeader,
  MenuHeaderTitle,
  MenuItem,
  MenuTrigger,
  SearchField,
  Token,
  useFilter,
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
  size?: ButtonProps["size"];
};

const getInitialMode = (selectedExampleIds: string[]) => {
  if (selectedExampleIds.length > 0) {
    return "apply";
  } else {
    return "filter";
  }
};

/**
 * The ExamplesSplitMenu is a menu that allows the user to filter or apply splits to examples.
 * It can be in one of two modes: filter, apply, or create.
 * In filter mode, the user can select splits from a list.
 * In apply mode, the user can select splits to add or remove from the selected examples.
 * In create mode, the user can create a new split.
 *
 * You can skip "filter" mode for single example use cases by passing in an empty array for selectedSplitIds,
 * and pre-populating the selectedExampleIds with the single example id and examplesCache with the single example.
 * @example
 * <ExamplesSplitMenu
 *   onSelectionChange={() => {}}
 *   onExampleSelectionChange={() => {}}
 *   selectedSplitIds={[]}
 *   selectedExampleIds={["123"]}
 *   // ensure this comes from relay so that it updates when the example splits are updated
 *   examplesCache={{ "123": { id: "123", datasetSplits: [{ id: "456", name: "Split 1" }] } }}
 * />
 */
export const ExamplesSplitMenu = ({
  onSelectionChange,
  onExampleSelectionChange,
  selectedSplitIds,
  selectedExampleIds,
  examplesCache,
  size,
}: ExamplesSplitMenuProps) => {
  const [mode, setMode] = useState<"filter" | "apply" | "create">(() =>
    getInitialMode(selectedExampleIds)
  );
  const [isMenuOpen, setIsMenuOpen] = useState(false); // used to keep the menu open when a split is applied
  const shouldKeepMenuOpenRef = useRef(false); // required as menu is no longer multi-select
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
  const requestKeepMenuOpen = useCallback(() => {
    shouldKeepMenuOpenRef.current = true;
  }, []);

  return (
    <MenuTrigger
      isOpen={isMenuOpen}
      onOpenChange={(open) => {
        if (!open && shouldKeepMenuOpenRef.current) {
          shouldKeepMenuOpenRef.current = false;
          setIsMenuOpen(true);
          return;
        }
        shouldKeepMenuOpenRef.current = false;
        setIsMenuOpen(open);
        if (!open) {
          setMode(getInitialMode(selectedExampleIds));
        }
      }}
    >
      <Button
        leadingVisual={<Icon svg={<Icons.PriceTagsOutline />} />}
        size={size}
      >
        Splits
        {selectedSplitIds.length > 0 ? ` (${selectedSplitIds.length})` : ""}
      </Button>
      <MenuContainer>
        <Suspense fallback={<Loading />}>
          {(mode === "filter" || mode === "apply") && (
            <SplitMenu
              selectedSplitIds={selectedSplitIds}
              onSelectionChange={dynamicOnSelectionChange}
              selectedExampleIds={selectedExampleIds}
              onExampleSelectionChange={onExampleSelectionChange}
              selectedPartialExamples={selectedPartialExamples}
              setMode={setMode}
              onRequestKeepMenuOpen={requestKeepMenuOpen}
            />
          )}
          {mode === "create" && (
            <SplitMenuCreateContent
              setMode={setMode}
              selectedExampleIds={selectedExampleIds}
            />
          )}
        </Suspense>
      </MenuContainer>
    </MenuTrigger>
  );
};

/**
 * The SplitMenu is a menu that allows the user to filter or apply splits to examples.
 * It can be in one of three modes: filter, or apply.
 * In filter mode, the user can select splits from a list.
 * In apply mode, the user can select splits to add or remove from the selected examples.
 */
const SplitMenu = ({
  selectedSplitIds,
  selectedExampleIds,
  onSelectionChange,
  selectedPartialExamples,
  setMode,
  onRequestKeepMenuOpen,
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
  onRequestKeepMenuOpen: () => void;
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
    // fetch when menu is opened, but show cache data first to prevent flickering
    { fetchPolicy: "store-and-network" }
  );
  const [setExampleSplits] = useMutation(graphql`
    mutation ExamplesSplitMenuSetDatasetExampleSplitsMutation(
      $input: SetDatasetExampleSplitsInput!
    ) {
      setDatasetExampleSplits(input: $input) {
        example {
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
    (changes: { exampleId: string; splitIds: string[] }) => {
      setExampleSplits({
        variables: {
          input: {
            exampleId: changes.exampleId,
            datasetSplitIds: changes.splitIds,
          },
        },
      });
    },
    [setExampleSplits]
  );
  const splits = useMemo(() => {
    return data.datasetSplits.edges.map((edge) => edge.split);
  }, [data]);
  return (
    <Autocomplete filter={contains}>
      <MenuHeader>
        <MenuHeaderTitle
          trailingContent={
            <IconButton
              size="S"
              onPress={() => {
                setMode("create");
              }}
            >
              <Icon svg={<Icons.PlusOutline />} />
            </IconButton>
          }
        >
          {selectedExampleIds.length > 0
            ? selectedExampleIds.length === 1
              ? "Apply splits to example"
              : "Apply splits to selected examples"
            : "Filter examples by splits"}
        </MenuHeaderTitle>
        <SearchField aria-label="Search" variant="quiet" autoFocus>
          <Input placeholder="Search splits" />
        </SearchField>
      </MenuHeader>
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
          onRequestKeepMenuOpen={onRequestKeepMenuOpen}
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
  onRequestKeepMenuOpen,
}: {
  onSelectionChange: (changes: {
    exampleId: string;
    splitIds: string[];
  }) => void;
  splits: { id: string; name: string; color: string }[];
  selectedPartialExamples: {
    id: string;
    datasetSplits: { id: string; name: string }[];
  }[];
  onRequestKeepMenuOpen: () => void;
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
  const handleSplitToggle = useCallback(
    (selectedId: string) => {
      // because the menu is no longer multi-select, we need to keep the menu open when a split is applied
      onRequestKeepMenuOpen();
      for (const example of selectedPartialExamples) {
        const currentSplitIds = example.datasetSplits.map((s) => s.id);
        let newSplitIds: string[];

        if (splitStates[selectedId] === "checked") {
          newSplitIds = currentSplitIds.filter((id) => id !== selectedId);
        } else {
          newSplitIds = currentSplitIds.includes(selectedId)
            ? currentSplitIds
            : [...currentSplitIds, selectedId];
        }

        onSelectionChange({
          exampleId: example.id,
          splitIds: newSplitIds,
        });
      }
    },
    [
      onRequestKeepMenuOpen,
      onSelectionChange,
      selectedPartialExamples,
      splitStates,
    ]
  );
  return (
    <Menu
      items={splits}
      renderEmptyState={() => "No splits found"}
      // NOTE: Menu is no longer multi-select, so we track the menu open state manually
      selectionMode="none"
      // ensure that menu items are re-rendered when splitStates changes
      dependencies={[splitStates]}
      onAction={(key) => handleSplitToggle(key as string)}
    >
      {({ id, name, color }) => (
        <MenuItem id={id} textValue={name}>
          <Flex alignItems="center" gap="size-200">
            <Checkbox
              excludeFromTabOrder
              isSelected={splitStates[id] === "checked"}
              isIndeterminate={splitStates[id] === "indeterminate"}
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
    <>
      <MenuHeader>
        <MenuHeaderTitle
          leadingContent={
            <IconButton onPress={() => setMode("filter")} size="S">
              <Icon svg={<Icons.ChevronLeft />} />
            </IconButton>
          }
        >
          Create Split
          {selectedExampleIds.length > 0
            ? " for " +
              selectedExampleIds.length +
              (selectedExampleIds.length === 1 ? " example" : " examples")
            : ""}
        </MenuHeaderTitle>
      </MenuHeader>
      <NewDatasetSplitForm
        onSubmit={onSubmit}
        isSubmitting={isCreatingDatasetSplit}
      />
    </>
  );
};
