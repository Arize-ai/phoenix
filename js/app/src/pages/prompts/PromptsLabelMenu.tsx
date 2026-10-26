import { css } from "@emotion/react";
import { Suspense, useMemo } from "react";
import { MenuSection } from "react-aria-components";
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
  MenuSectionTitle,
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
 * The PromptsLabelMenu is a menu that allows the user to filter prompts and
 * decisions by labels. Prompt labels and decision labels are listed in
 * separate sections. A prompt matches when it carries one of the selected
 * prompt labels and a decision when it carries one of the selected decision
 * labels, so selecting labels of only one kind hides the other kind. It is
 * intentionally kept in sync with the datasets label filter
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
 * The LabelMenuFilterContent displays a multi-select menu of prompt and
 * decision labels for filtering the prompts table.
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
        decisionLabels(first: 100) {
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

  const promptLabels = useMemo(
    () => data.promptLabels.edges.map((edge) => edge.label),
    [data]
  );
  const decisionLabels = useMemo(
    () => data.decisionLabels.edges.map((edge) => edge.label),
    [data]
  );

  const handleSelectionChange = (selection: Selection) => {
    if (selection === "all") {
      onSelectionChange(
        [...promptLabels, ...decisionLabels].map((label) => label.id)
      );
      return;
    }
    onSelectionChange([...selection] as string[]);
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
          {promptLabels.length > 0 ? (
            <MenuSection>
              <MenuSectionTitle title="Prompt labels" />
              {promptLabels.map((label) => (
                <LabelMenuItem key={label.id} {...label} />
              ))}
            </MenuSection>
          ) : null}
          {decisionLabels.length > 0 ? (
            <MenuSection>
              <MenuSectionTitle title="Decision labels" />
              {decisionLabels.map((label) => (
                <LabelMenuItem key={label.id} {...label} />
              ))}
            </MenuSection>
          ) : null}
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

function LabelMenuItem({
  id,
  name,
  color,
}: {
  id: string;
  name: string;
  color: string | null;
}) {
  return (
    <MenuItem
      id={id}
      textValue={name}
      leadingContent={
        <ColorSwatch color={color ?? undefined} size="M" shape="circle" />
      }
    >
      {name}
    </MenuItem>
  );
}
