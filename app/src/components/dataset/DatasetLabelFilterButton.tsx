import { Suspense, useState } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { css } from "@emotion/react";

import {
  Button,
  ColorSwatch,
  DebouncedSearch,
  DialogTrigger,
  Flex,
  Icon,
  Icons,
  ListBox,
  ListBoxItem,
  Loading,
  Popover,
  type Selection,
  View,
} from "@phoenix/components";

import { DatasetLabelFilterButtonQuery } from "./__generated__/DatasetLabelFilterButtonQuery.graphql";

type DatasetLabelFilterButtonProps = {
  selectedLabelIds: string[];
  onSelectionChange: (labelIds: string[]) => void;
};

export function DatasetLabelFilterButton(props: DatasetLabelFilterButtonProps) {
  const { selectedLabelIds, onSelectionChange } = props;

  const buttonText =
    selectedLabelIds.length > 0
      ? `Labels (${selectedLabelIds.length})`
      : "Labels";

  return (
    <DialogTrigger>
      <Button
        variant="default"
        size="M"
        trailingVisual={<Icon svg={<Icons.ChevronDown />} />}
      >
        {buttonText}
      </Button>
      <Popover placement="bottom end">
        <Suspense fallback={<Loading />}>
          <DatasetLabelFilterContent
            selectedLabelIds={selectedLabelIds}
            onSelectionChange={onSelectionChange}
          />
        </Suspense>
      </Popover>
    </DialogTrigger>
  );
}

function DatasetLabelFilterContent({
  selectedLabelIds,
  onSelectionChange,
}: {
  selectedLabelIds: string[];
  onSelectionChange: (labelIds: string[]) => void;
}) {
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

  const [search, setSearch] = useState("");

  const labels = labelData.datasetLabels.edges
    .map((edge) => edge.node)
    .filter((label) => {
      return label.name.toLowerCase().includes(search.toLowerCase());
    });

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
    <View padding="size-200">
      <Flex direction="column" gap="size-100">
        <DebouncedSearch
          autoFocus
          aria-label="Search labels"
          placeholder="Search labels..."
          onChange={setSearch}
        />
        <ListBox
          aria-label="labels"
          items={labels}
          selectionMode="multiple"
          selectedKeys={selectedLabelIds}
          onSelectionChange={handleSelectionChange}
          css={css`
            height: 300px;
            width: 320px;
          `}
          renderEmptyState={() => "No labels found"}
        >
          {(item) => <DatasetLabelFilterItem key={item.id} item={item} />}
        </ListBox>
        <Flex direction="row" justifyContent="end" alignItems="center">
          <Button variant="quiet" size="S" onPress={handleClear}>
            Clear All
          </Button>
        </Flex>
      </Flex>
    </View>
  );
}

function DatasetLabelFilterItem({
  item,
}: {
  item: { id: string; name: string; color: string };
}) {
  return (
    <ListBoxItem key={item.id} id={item.id}>
      {({ isSelected }) => (
        <Flex direction="row" justifyContent="space-between">
          <Flex direction="row" gap="size-100" alignItems="center">
            <ColorSwatch color={item.color} size="M" shape="circle" />
            {item.name}
          </Flex>
          {isSelected ? <Icon svg={<Icons.CheckmarkOutline />} /> : null}
        </Flex>
      )}
    </ListBoxItem>
  );
}
