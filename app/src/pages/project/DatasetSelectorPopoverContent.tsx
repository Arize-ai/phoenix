import { useMemo, useState } from "react";
import { graphql, useLazyLoadQuery, useRefetchableFragment } from "react-relay";
import { css } from "@emotion/react";

import { Card, Item, ListBox } from "@arizeai/components";

import {
  Button,
  Flex,
  Input,
  SearchField,
  Text,
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
  const [search, setSearch] = useState<string>("");
  const data = useLazyLoadQuery<DatasetSelectorPopoverContentQuery>(
    graphql`
      query DatasetSelectorPopoverContentQuery {
        ...DatasetSelectorPopoverContent_datasets
      }
    `,
    {},
    { fetchPolicy: "network-only" }
  );
  return (
    <Card
      title="Add to Dataset"
      variant="compact"
      backgroundColor="light"
      borderColor="light"
      bodyStyle={{ padding: 0 }}
      extra={
        <Button variant="default" size="S" onPress={onCreateNewDataset}>
          New Dataset
        </Button>
      }
    >
      <View padding="size-100">
        <SearchField
          onChange={(newSearch) => {
            setSearch(newSearch);
          }}
        >
          <Input placeholder="Search datasets" />
        </SearchField>
      </View>
      <View borderTopWidth="thin" borderColor="light">
        <div
          css={css`
            height: 400px;
            overflow-y: auto;
            min-width: 300px;
          `}
        >
          <DatasetsListBox
            query={data}
            search={search}
            onDatasetSelected={onDatasetSelected}
          />
        </div>
      </View>
    </Card>
  );
}

function DatasetsListBox(props: {
  search: string;
  query: DatasetSelectorPopoverContent_datasets$key;
  onDatasetSelected: (datasetId: string) => void;
}) {
  const { search, onDatasetSelected } = props;
  const [data] = useRefetchableFragment<
    DatasetSelectorPopoverContentDatasetsQuery,
    DatasetSelectorPopoverContent_datasets$key
  >(
    graphql`
      fragment DatasetSelectorPopoverContent_datasets on Query
      @refetchable(queryName: "DatasetSelectorPopoverContentDatasetsQuery") {
        datasets {
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
  const datasets = useMemo(() => {
    let datasets = data.datasets.edges.map((edge) => edge.dataset);
    if (search) {
      datasets = datasets.filter((dataset) =>
        dataset.name.toLowerCase().includes(search.toLowerCase())
      );
    }
    return datasets;
  }, [search, data]);

  const isEmpty = datasets.length === 0;
  if (isEmpty) {
    return (
      <View padding="size-200">
        <Flex
          direction="column"
          justifyContent="center"
          alignItems="center"
          flex="1 1 auto"
        >
          <Text>No datasets found</Text>
        </Flex>
      </View>
    );
  }
  return (
    <ListBox
      selectionMode="single"
      onSelectionChange={(selection) => {
        if (typeof selection === "object") {
          const selectedDatasetIds = Array.from(selection);
          onDatasetSelected(selectedDatasetIds[0] as string);
        }
      }}
    >
      {datasets.map((ds) => (
        <Item key={ds.id}>{ds.name}</Item>
      ))}
    </ListBox>
  );
}
