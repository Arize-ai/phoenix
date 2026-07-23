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
  MenuFooter,
  MenuHeader,
  MenuItem,
  MenuTrigger,
  Popover,
  SearchField,
  type Selection,
  useFilter,
} from "@phoenix/components";
import { CompactEmptyState } from "@phoenix/components/core/empty";
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
        leadingVisual={<Icon svg={<Icons.PriceTags />} />}
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
      onSelectionChange(labels.map((l) => l.id));
      return;
    }
    onSelectionChange([...selection].map(String));
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
          renderEmptyState={() => (
            <CompactEmptyState
              icon={<Icon svg={<Icons.PriceTags />} />}
              description="No labels"
            />
          )}
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
        <Button
          variant="quiet"
          size="S"
          onPress={handleClear}
          isDisabled={selectedLabelIds.length === 0}
        >
          Clear All
        </Button>
      </MenuFooter>
    </>
  );
}
