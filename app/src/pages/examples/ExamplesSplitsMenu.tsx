import { Suspense, useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import {
  Autocomplete,
  Button,
  ButtonProps,
  Icon,
  Icons,
  Input,
  Loading,
  Menu,
  MenuContainer,
  MenuHeader,
  MenuItem,
  MenuTrigger,
  SearchField,
  Token,
  useFilter,
} from "@phoenix/components";
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
 */
export const ExamplesSplitsMenu = ({
  onSelectionChange,
  selectedSplitIds,
  size,
}: ExamplesSplitsMenuProps) => {
  return (
    <MenuTrigger>
      <Button
        leadingVisual={<Icon svg={<Icons.PieChartOutline />} />}
        size={size}
      >
        Splits
        {selectedSplitIds.length > 0 ? ` (${selectedSplitIds.length})` : ""}
      </Button>
      <MenuContainer>
        <Suspense fallback={<Loading />}>
          <SplitFilterMenu
            selectedSplitIds={selectedSplitIds}
            onSelectionChange={onSelectionChange}
          />
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
}: {
  selectedSplitIds: string[];
  onSelectionChange: (splitIds: string[]) => void;
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
