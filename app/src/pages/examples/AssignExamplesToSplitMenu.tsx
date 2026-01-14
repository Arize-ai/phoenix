import { Suspense, useCallback, useMemo, useRef, useState } from "react";
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
import { SearchIcon } from "@phoenix/components/field";
import { ExamplesCache } from "@phoenix/pages/examples/ExamplesFilterContext";
import { Mutable } from "@phoenix/typeUtils";

import { AssignExamplesToSplitMenuQuery } from "./__generated__/AssignExamplesToSplitMenuQuery.graphql";

type AssignExamplesToSplitMenuProps = {
  selectedExampleIds: string[];
  examplesCache: ExamplesCache;
  size?: ButtonProps["size"];
};

/**
 * The AssignExamplesToSplitMenu is a menu that allows the user to assign splits to selected examples.
 * It can be in one of two modes: apply or create.
 * In apply mode, the user can select splits to add or remove from the selected examples.
 * In create mode, the user can create a new split and optionally assign it to the selected examples.
 */
export const AssignExamplesToSplitMenu = ({
  selectedExampleIds,
  examplesCache,
  size,
}: AssignExamplesToSplitMenuProps) => {
  const [mode, setMode] = useState<"apply" | "create">("apply");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const shouldKeepMenuOpenRef = useRef(false);

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
          setMode("apply");
        }
      }}
    >
      <Button
        leadingVisual={<Icon svg={<Icons.PieChartOutline />} />}
        size={size}
      >
        Assign to splits
      </Button>
      <MenuContainer placement="top start" shouldFlip>
        <Suspense fallback={<Loading />}>
          {mode === "apply" && (
            <SplitApplyMenu
              selectedPartialExamples={selectedPartialExamples}
              setMode={setMode}
              onRequestKeepMenuOpen={requestKeepMenuOpen}
            />
          )}
          {mode === "create" && (
            <SplitCreateMenu
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
 * The SplitApplyMenu displays a list of splits that the user can toggle to apply to selected examples.
 */
const SplitApplyMenu = ({
  selectedPartialExamples,
  setMode,
  onRequestKeepMenuOpen,
}: {
  selectedPartialExamples: {
    id: string;
    datasetSplits: { id: string; name: string }[];
  }[];
  setMode: (mode: "apply" | "create") => void;
  onRequestKeepMenuOpen: () => void;
}) => {
  const { contains } = useFilter({ sensitivity: "base" });
  const data = useLazyLoadQuery<AssignExamplesToSplitMenuQuery>(
    graphql`
      query AssignExamplesToSplitMenuQuery {
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
    mutation AssignExamplesToSplitMenuSetDatasetExampleSplitsMutation(
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
          Assign to splits
        </MenuHeaderTitle>
        <SearchField aria-label="Search" variant="quiet" autoFocus size="L">
          <SearchIcon />
          <Input placeholder="Search splits" />
        </SearchField>
      </MenuHeader>
      <SplitMenuApplyContent
        onSelectionChange={onUpdateSplits}
        splits={splits as Mutable<typeof splits>}
        selectedPartialExamples={selectedPartialExamples}
        onRequestKeepMenuOpen={onRequestKeepMenuOpen}
      />
    </Autocomplete>
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

const SplitCreateMenu = ({
  setMode,
  selectedExampleIds,
}: {
  setMode: (mode: "apply" | "create") => void;
  selectedExampleIds: string[];
}) => {
  const onCompleted = useCallback(() => {
    setMode("apply");
  }, [setMode]);
  const { onSubmit, isCreatingDatasetSplit } = useDatasetSplitMutations({
    exampleIds: selectedExampleIds,
    onCompleted,
  });
  return (
    <>
      <MenuHeader>
        <MenuHeaderTitle
          leadingContent={
            <IconButton onPress={() => setMode("apply")} size="S">
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
