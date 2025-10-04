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
  const [isOpen, setIsOpen] = useState(false);

  const buttonText =
    selectedLabelIds.length > 0
      ? `Labels (${selectedLabelIds.length})`
      : "Labels";

  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
      <Button
        variant="default"
        size="M"
        leadingVisual={<Icon svg={<Icons.PriceTagsOutline />} />}
      >
        {buttonText}
      </Button>
      <Popover placement="bottom end">
        <Suspense fallback={<Loading />}>
          <DatasetLabelFilterContent
            selectedLabelIds={selectedLabelIds}
            onSelectionChange={onSelectionChange}
            onClose={() => setIsOpen(false)}
          />
        </Suspense>
      </Popover>
    </DialogTrigger>
  );
}

function DatasetLabelFilterContent({
  selectedLabelIds,
  onSelectionChange,
  onClose,
}: {
  selectedLabelIds: string[];
  onSelectionChange: (labelIds: string[]) => void;
  onClose: () => void;
}) {
  const labelData = useLazyLoadQuery<DatasetLabelFilterButtonQuery>(
    graphql`
      query DatasetLabelFilterButtonQuery {
        datasetLabels(first: 100) {
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
  const [selected, setSelected] = useState<Selection>(
    () => new Set(selectedLabelIds)
  );

  const labels = labelData.datasetLabels.edges
    .map((edge) => edge.node)
    .filter((label) => {
      return label.name.toLowerCase().includes(search.toLowerCase());
    });

  const handleSelectionChange = (selection: Selection) => {
    if (selection === "all") {
      return;
    }
    setSelected(selection);
  };

  const handleApply = () => {
    const newLabelIds = [...selected] as string[];
    onSelectionChange(newLabelIds);
    onClose();
  };

  const handleClear = () => {
    setSelected(new Set());
    onSelectionChange([]);
    onClose();
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
          selectedKeys={selected}
          onSelectionChange={handleSelectionChange}
          css={css`
            height: 300px;
            width: 320px;
          `}
          renderEmptyState={() => "No labels found"}
        >
          {(item) => <DatasetLabelFilterItem key={item.id} item={item} />}
        </ListBox>
        <Flex
          direction="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Button variant="quiet" size="S" onPress={handleClear}>
            Clear All
          </Button>
          <Button variant="primary" size="S" onPress={handleApply}>
            Apply Filter
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
