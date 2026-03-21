import { Suspense, useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import {
  Autocomplete,
  Button,
  ColorSwatch,
  Counter,
  Icon,
  Icons,
  Input,
  Loading,
  Menu,
  MenuEmpty,
  MenuFooter,
  MenuHeader,
  MenuItem,
  MenuTrigger,
  Popover,
  SearchField,
  type Selection,
  useFilter,
} from "@phoenix/components";
import { SearchIcon } from "@phoenix/components/core/field";

import type { DatasetLabelFilterButtonQuery } from "./__generated__/DatasetLabelFilterButtonQuery.graphql";

type DatasetLabelFilterButtonProps = {
  selectedLabelIds: string[];
  onSelectionChange: (labelIds: string[]) => void;
};

export function DatasetLabelFilterButton(props: DatasetLabelFilterButtonProps) {
  const { selectedLabelIds, onSelectionChange } = props;

  return (
    <MenuTrigger>
      <Button
        variant="default"
        size="M"
        leadingVisual={<Icon svg={<Icons.PriceTagsOutline />} />}
        trailingVisual={
          selectedLabelIds.length > 0 ? (
            <Counter>{selectedLabelIds.length}</Counter>
          ) : undefined
        }
      >
        Labels
      </Button>
      <Popover placement="bottom end">
        <Suspense fallback={<Loading />}>
          <DatasetLabelFilterContent
            selectedLabelIds={selectedLabelIds}
            onSelectionChange={onSelectionChange}
          />
        </Suspense>
      </Popover>
    </MenuTrigger>
  );
}

function DatasetLabelFilterContent({
  selectedLabelIds,
  onSelectionChange,
}: {
  selectedLabelIds: string[];
  onSelectionChange: (labelIds: string[]) => void;
}) {
  const { contains } = useFilter({ sensitivity: "base" });
  const labelData = useLazyLoadQuery<DatasetLabelFilterButtonQuery>(
    graphql`
      query DatasetLabelFilterButtonQuery {
        datasetLabels(first: 100)
          @connection(key: "DatasetLabelFilterButton_datasetLabels") {
          edges {
            node {
              id
              name
              color
            }
          }
        }
      }
    `,
    {},
    { fetchPolicy: "store-and-network" }
  );

  const labels = useMemo(
    () => labelData.datasetLabels.edges.map((edge) => edge.node),
    [labelData]
  );

  const handleSelectionChange = (selection: Selection) => {
    if (selection === "all") {
      return;
    }
    const newLabelIds = [...selection] as string[];
    onSelectionChange(newLabelIds);
  };

  const handleClear = () => {
    onSelectionChange([]);
  };

  return (
    <>
      <Autocomplete filter={contains}>
        <MenuHeader>
          <SearchField aria-label="Search labels" variant="quiet" autoFocus>
            <SearchIcon />
            <Input placeholder="Search labels..." />
          </SearchField>
        </MenuHeader>
        <Menu
          aria-label="labels"
          items={labels}
          selectionMode="multiple"
          selectedKeys={selectedLabelIds}
          onSelectionChange={handleSelectionChange}
          renderEmptyState={() => <MenuEmpty>No labels found</MenuEmpty>}
        >
          {({ id, name, color }) => (
            <MenuItem
              id={id}
              textValue={name}
              leadingContent={
                <ColorSwatch color={color} size="M" shape="circle" />
              }
            >
              {name}
            </MenuItem>
          )}
        </Menu>
      </Autocomplete>
      <MenuFooter>
        <Button variant="quiet" size="S" onPress={handleClear}>
          Clear All
        </Button>
      </MenuFooter>
    </>
  );
}
