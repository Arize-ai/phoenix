import { css } from "@emotion/react";
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
import type { PromptsLabelMenuQuery } from "@phoenix/pages/prompts/__generated__/PromptsLabelMenuQuery.graphql";

type PromptsLabelMenuProps = {
  onSelectionChange: (labelIds: string[]) => void;
  selectedLabelIds: string[];
};

/**
 * The PromptsLabelMenu is a menu that allows the user to filter prompts by
 * labels. It is intentionally kept in sync with the datasets label filter
 * ({@link DatasetLabelFilterButton}) so the two list pages behave identically.
 */
export const PromptsLabelMenu = ({
  onSelectionChange,
  selectedLabelIds,
}: PromptsLabelMenuProps) => {
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
        <Suspense
          fallback={
            <Loading
              css={css`
                min-width: 300px;
                min-height: 200px;
              `}
            />
          }
        >
          <LabelMenuFilterContent
            selectedLabelIds={selectedLabelIds}
            onSelectionChange={onSelectionChange}
          />
        </Suspense>
      </Popover>
    </MenuTrigger>
  );
};

/**
 * The LabelMenuFilterContent displays a multi-select menu of labels for filtering prompts.
 */
const LabelMenuFilterContent = ({
  selectedLabelIds,
  onSelectionChange,
}: {
  selectedLabelIds: string[];
  onSelectionChange: (labelIds: string[]) => void;
}) => {
  const { contains } = useFilter({ sensitivity: "base" });
  const data = useLazyLoadQuery<PromptsLabelMenuQuery>(
    graphql`
      query PromptsLabelMenuQuery {
        promptLabels(first: 100) {
          edges {
            label: node {
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

  const labels = useMemo(() => {
    return data.promptLabels.edges.map((edge) => edge.label);
  }, [data]);

  const handleSelectionChange = (selection: Selection) => {
    if (selection === "all") {
      onSelectionChange(labels.map((l) => l.id));
      return;
    }
    onSelectionChange(
      [...selection].filter((key): key is string => typeof key === "string")
    );
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
          renderEmptyState={() => (
            <CompactEmptyState
              icon={<Icon svg={<Icons.PriceTags />} />}
              description="No labels"
            />
          )}
          selectedKeys={selectedLabelIds}
          onSelectionChange={handleSelectionChange}
        >
          {({ id, name, color }) => (
            <MenuItem
              id={id}
              textValue={name}
              leadingContent={
                <ColorSwatch
                  color={color ?? undefined}
                  size="M"
                  shape="circle"
                />
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
};
