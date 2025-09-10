import { startTransition, useMemo } from "react";
import { graphql, useLazyLoadQuery, useRefetchableFragment } from "react-relay";
import { css } from "@emotion/react";

import {
  Autocomplete,
  DebouncedSearch,
  Flex,
  Heading,
  Icon,
  IconButton,
  Icons,
  ListBox,
  ListBoxItem,
  useFilter,
  View,
} from "@phoenix/components";

import { DatasetSelectorPopoverContent_datasets$key } from "./__generated__/DatasetSelectorPopoverContent_datasets.graphql";
import { DatasetSelectorPopoverContentDatasetsQuery } from "./__generated__/DatasetSelectorPopoverContentDatasetsQuery.graphql";
import { DatasetSelectorPopoverContentQuery } from "./__generated__/DatasetSelectorPopoverContentQuery.graphql";

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
      <View padding="size-100" borderBottomWidth="thin" borderColor="dark">
        <Flex direction="column" gap="size-50">
          <Flex
            direction="row"
            justifyContent="space-between"
            alignItems="center"
          >
            <Heading level={4} weight="heavy">
              Add to Dataset
            </Heading>
            <IconButton size="S" onPress={onCreateNewDataset}>
              <Icon svg={<Icons.PlusOutline />} />
            </IconButton>
          </Flex>
          <DebouncedSearch
            autoFocus
            aria-label="Search datasets"
            placeholder="Search datasets..."
            onChange={onSearchChange}
          />
        </Flex>
      </View>

      <ListBox
        aria-label="datasets"
        selectionMode="single"
        css={css`
          height: 300px;
          width: 300px;
        `}
        renderEmptyState={() => "No datasets found"}
        onSelectionChange={(selection) => {
          if (typeof selection === "object") {
            const selectedDatasetIds = Array.from(selection);
            onDatasetSelected(selectedDatasetIds[0] as string);
          }
        }}
      >
        {items.map((item) => (
          <ListBoxItem key={item.id} id={item.id}>
            {item.name}
          </ListBoxItem>
        ))}
      </ListBox>
    </Autocomplete>
  );
}
