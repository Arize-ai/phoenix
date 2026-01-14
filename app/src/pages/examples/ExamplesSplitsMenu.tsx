import { Suspense, useCallback, useMemo, useState } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import {
  Autocomplete,
  Button,
  ButtonProps,
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
import { ExamplesSplitsMenuQuery } from "@phoenix/pages/examples/__generated__/ExamplesSplitsMenuQuery.graphql";
import { Mutable } from "@phoenix/typeUtils";

type ExamplesSplitsMenuProps = {
  onSelectionChange: (splitIds: string[]) => void;
  selectedSplitIds: string[];
  size?: ButtonProps["size"];
};

/**
 * The ExamplesSplitsMenu is a menu that allows the user to filter examples by splits.
 * It can be in one of two modes: filter or create.
 * In filter mode, the user can select splits from a list.
 * In create mode, the user can create a new split.
 */
export const ExamplesSplitsMenu = ({
  onSelectionChange,
  selectedSplitIds,
  size,
}: ExamplesSplitsMenuProps) => {
  const [mode, setMode] = useState<"filter" | "create">("filter");

  return (
    <MenuTrigger
      onOpenChange={(open) => {
        if (!open) {
          setMode("filter");
        }
      }}
    >
      <Button
        leadingVisual={<Icon svg={<Icons.PieChartOutline />} />}
        size={size}
      >
        Splits
        {selectedSplitIds.length > 0 ? ` (${selectedSplitIds.length})` : ""}
      </Button>
      <MenuContainer>
        <Suspense fallback={<Loading />}>
          {mode === "filter" && (
            <SplitFilterMenu
              selectedSplitIds={selectedSplitIds}
              onSelectionChange={onSelectionChange}
              setMode={setMode}
            />
          )}
          {mode === "create" && <SplitCreateMenu setMode={setMode} />}
        </Suspense>
      </MenuContainer>
    </MenuTrigger>
  );
};

/**
 * The SplitFilterMenu displays a list of splits that the user can select to filter examples.
 */
const SplitFilterMenu = ({
  selectedSplitIds,
  onSelectionChange,
  setMode,
}: {
  selectedSplitIds: string[];
  onSelectionChange: (splitIds: string[]) => void;
  setMode: (mode: "filter" | "create") => void;
}) => {
  const { contains } = useFilter({ sensitivity: "base" });
  const data = useLazyLoadQuery<ExamplesSplitsMenuQuery>(
    graphql`
      query ExamplesSplitsMenuQuery {
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
          Filter examples by splits
        </MenuHeaderTitle>
        <SearchField aria-label="Search" variant="quiet" autoFocus size="L">
          <SearchIcon />
          <Input placeholder="Search splits" />
        </SearchField>
      </MenuHeader>
      <SplitMenuFilterContent
        selectedSplitIds={selectedSplitIds}
        onSelectionChange={onSelectionChange}
        splits={splits as Mutable<typeof splits>}
      />
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

const SplitCreateMenu = ({
  setMode,
}: {
  setMode: (mode: "filter" | "create") => void;
}) => {
  const onCompleted = useCallback(() => {
    setMode("filter");
  }, [setMode]);
  const { onSubmit, isCreatingDatasetSplit } = useDatasetSplitMutations({
    exampleIds: [],
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
        </MenuHeaderTitle>
      </MenuHeader>
      <NewDatasetSplitForm
        onSubmit={onSubmit}
        isSubmitting={isCreatingDatasetSplit}
      />
    </>
  );
};
