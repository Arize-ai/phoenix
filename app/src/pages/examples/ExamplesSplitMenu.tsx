import { Suspense, useCallback, useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import {
  Autocomplete,
  Button,
  Flex,
  Heading,
  Icon,
  IconButton,
  Icons,
  Input,
  Loading,
  Menu,
  MenuItem,
  MenuTrigger,
  Popover,
  SearchField,
  Token,
  useFilter,
  View,
} from "@phoenix/components";
import { ExamplesSplitMenuQuery } from "@phoenix/pages/examples/__generated__/ExamplesSplitMenuQuery.graphql";

type ExamplesSplitMenuProps = {
  datasetId: string;
  onSelectionChange: (splitIds: string[]) => void;
  onExampleSelectionChange: (exampleIds: string[]) => void;
  selectedSplitIds: string[];
  selectedExampleIds: string[];
};

export const ExamplesSplitMenu = ({
  datasetId,
  onSelectionChange,
  onExampleSelectionChange,
  selectedSplitIds,
  selectedExampleIds,
}: ExamplesSplitMenuProps) => {
  const dynamicOnSelectionChange = useCallback(
    (splitIds: string[]) => {
      if (selectedExampleIds.length > 0) {
        onExampleSelectionChange([]);
        onSelectionChange(splitIds);
      } else {
        onSelectionChange(splitIds);
      }
    },
    [onSelectionChange, onExampleSelectionChange, selectedExampleIds]
  );
  return (
    <MenuTrigger>
      <Button trailingVisual={<Icon svg={<Icons.ChevronDown />} />}>
        Splits
      </Button>
      <Popover>
        <Suspense fallback={<Loading />}>
          <SplitMenu
            datasetId={datasetId}
            selectedSplitIds={selectedSplitIds}
            onSelectionChange={dynamicOnSelectionChange}
            selectedExampleIds={selectedExampleIds}
            onExampleSelectionChange={onExampleSelectionChange}
          />
        </Suspense>
      </Popover>
    </MenuTrigger>
  );
};

const SplitMenu = ({
  datasetId,
  selectedSplitIds,
  selectedExampleIds,
  onSelectionChange,
  onExampleSelectionChange,
}: {
  datasetId: string;
  selectedSplitIds: string[];
  selectedExampleIds: string[];
  onSelectionChange: (splitIds: string[]) => void;
  onExampleSelectionChange: (exampleIds: string[]) => void;
}) => {
  const { contains } = useFilter({ sensitivity: "base" });
  const data = useLazyLoadQuery<ExamplesSplitMenuQuery>(
    graphql`
      query ExamplesSplitMenuQuery($datasetId: ID!) {
        node(id: $datasetId) {
          ... on Dataset {
            splits {
              id
              name
              color
            }
          }
        }
      }
    `,
    { datasetId },
    { fetchPolicy: "network-only" }
  );
  const splits = useMemo(() => {
    return data.node?.splits ?? [];
  }, [data]);
  return (
    <Autocomplete filter={contains}>
      <View
        padding="size-100"
        paddingTop="size-50"
        borderBottomWidth="thin"
        borderColor="dark"
        minWidth={300}
      >
        <Flex direction="column" gap="size-50">
          <Flex
            direction="row"
            justifyContent="space-between"
            alignItems="center"
          >
            <Heading level={4} weight="heavy">
              {selectedExampleIds.length > 0
                ? "Apply splits to selected examples"
                : "Filter examples by splits"}
            </Heading>
            <IconButton
              size="S"
              onPress={() => {
                onSelectionChange([]);
                onExampleSelectionChange([]);
              }}
            >
              <Icon svg={<Icons.PlusOutline />} />
            </IconButton>
          </Flex>
          <SearchField aria-label="Search" autoFocus>
            <Input placeholder="Search splits" />
          </SearchField>
        </Flex>
      </View>
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
    </Autocomplete>
  );
};
