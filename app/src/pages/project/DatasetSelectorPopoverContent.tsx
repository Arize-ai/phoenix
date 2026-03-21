import { startTransition, useMemo } from "react";
import { graphql, useLazyLoadQuery, useRefetchableFragment } from "react-relay";

import {
  Autocomplete,
  Icon,
  IconButton,
  Icons,
  Input,
  Menu,
  MenuEmpty,
  MenuHeader,
  MenuHeaderTitle,
  MenuItem,
  SearchField,
  useFilter,
} from "@phoenix/components";
import { SearchIcon } from "@phoenix/components/core/field";

import type { DatasetSelectorPopoverContent_datasets$key } from "./__generated__/DatasetSelectorPopoverContent_datasets.graphql";
import type { DatasetSelectorPopoverContentDatasetsQuery } from "./__generated__/DatasetSelectorPopoverContentDatasetsQuery.graphql";
import type { DatasetSelectorPopoverContentQuery } from "./__generated__/DatasetSelectorPopoverContentQuery.graphql";

export type DatasetSelectorPopoverContentProps = {
  onCreateNewDataset: () => void;
  onDatasetSelected: (datasetId: string) => void;
};
export function DatasetSelectorPopoverContent(
  props: DatasetSelectorPopoverContentProps
) {
  const { onCreateNewDataset, onDatasetSelected } = props;
  const query = useLazyLoadQuery<DatasetSelectorPopoverContentQuery>(
    graphql`
      query DatasetSelectorPopoverContentQuery {
        ...DatasetSelectorPopoverContent_datasets @arguments(search: "")
      }
    `,
    {},
    { fetchPolicy: "network-only" }
  );
  return (
    <DatasetsList
      query={query}
      onCreateNewDataset={onCreateNewDataset}
      onDatasetSelected={onDatasetSelected}
    />
  );
}

function DatasetsList(props: {
  query: DatasetSelectorPopoverContent_datasets$key;
  onDatasetSelected: (datasetId: string) => void;
  onCreateNewDataset: () => void;
}) {
  const { contains } = useFilter({ sensitivity: "base" });

  const { onDatasetSelected, onCreateNewDataset } = props;
  const [data, refetch] = useRefetchableFragment<
    DatasetSelectorPopoverContentDatasetsQuery,
    DatasetSelectorPopoverContent_datasets$key
  >(
    graphql`
      fragment DatasetSelectorPopoverContent_datasets on Query
      @refetchable(queryName: "DatasetSelectorPopoverContentDatasetsQuery")
      @argumentDefinitions(search: { type: "String!" }) {
        datasets(filter: { col: name, value: $search }) {
          edges {
            dataset: node {
              id
              name
            }
          }
        }
      }
    `,
    props.query
  );

  const items = useMemo(() => {
    return data.datasets.edges.map((edge) => edge.dataset);
  }, [data]);

  const onSearchChange = (search: string) => {
    startTransition(() => {
      refetch({ search });
    });
  };

  return (
    <Autocomplete filter={contains}>
      <MenuHeader>
        <MenuHeaderTitle
          trailingContent={
            <IconButton size="S" onPress={onCreateNewDataset}>
              <Icon svg={<Icons.PlusOutline />} />
            </IconButton>
          }
        >
          Add to Dataset
        </MenuHeaderTitle>
        <SearchField
          aria-label="Search datasets"
          variant="quiet"
          autoFocus
          onChange={onSearchChange}
        >
          <SearchIcon />
          <Input placeholder="Search datasets..." />
        </SearchField>
      </MenuHeader>
      <Menu
        aria-label="datasets"
        items={items}
        selectionMode="single"
        renderEmptyState={() => <MenuEmpty>No datasets found</MenuEmpty>}
        onSelectionChange={(selection) => {
          if (typeof selection === "object") {
            const selectedDatasetIds = Array.from(selection);
            onDatasetSelected(selectedDatasetIds[0] as string);
          }
        }}
      >
        {(item) => (
          <MenuItem id={item.id} textValue={item.name}>
            {item.name}
          </MenuItem>
        )}
      </Menu>
    </Autocomplete>
  );
}
