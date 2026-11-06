import { Autocomplete, Input, useFilter } from "react-aria-components";

import {
  Button,
  Icon,
  Icons,
  Menu,
  MenuContainer,
  MenuHeader,
  MenuItem,
  MenuTrigger,
  SearchField,
  SelectChevronUpDownIcon,
  Text,
} from "@phoenix/components";
import { CompactEmptyState } from "@phoenix/components/core/empty";
import { SearchIcon } from "@phoenix/components/core/field";
import { Truncate } from "@phoenix/components/core/utility/Truncate";
import { sourceMenuTriggerCSS } from "@phoenix/pages/playground/searchablePickerStyles";

export type PromptOrDecisionMenuItem = {
  id: string;
  name: string;
};

export type PromptOrDecisionMenuProps = {
  items: readonly PromptOrDecisionMenuItem[];
  /** The selected item; it need not be in `items`. */
  selectedItem: PromptOrDecisionMenuItem | null;
  onSelect: (id: string) => void;
  isDisabled?: boolean;
  /**
   * Whether a version selector sits to the trigger's right in a
   * `CompositeField`, so the trigger drops its right edge to join it.
   */
  hasVersionSelector: boolean;
  /** Trigger text when nothing is selected, e.g. "Select a prompt". */
  placeholder: string;
  /** Trigger text when there is nothing to pick, e.g. "No saved prompts". */
  noItemsText: string;
  /** Label and placeholder of the search field, e.g. "Search prompts". */
  searchLabel: string;
  /** Shown in the menu when the search matches nothing, e.g. "No prompts". */
  noMatchesText: string;
  "data-testid"?: string;
};

/**
 * Picks a saved prompt or decision from a searchable menu. Sits to the left
 * of its version selector once something is selected.
 */
export function PromptOrDecisionMenu({
  items,
  selectedItem,
  onSelect,
  isDisabled,
  hasVersionSelector,
  placeholder,
  noItemsText,
  searchLabel,
  noMatchesText,
  "data-testid": testId,
}: PromptOrDecisionMenuProps) {
  const { contains } = useFilter({ sensitivity: "base" });
  const hasItems = items.length > 0;
  return (
    <MenuTrigger>
      <Button
        data-testid={testId}
        size="S"
        className={hasVersionSelector ? "left-child" : undefined}
        isDisabled={isDisabled || !hasItems}
        data-has-selection={selectedItem ? true : undefined}
        css={sourceMenuTriggerCSS}
      >
        <Truncate maxWidth="var(--text-max-width)" title={selectedItem?.name}>
          {selectedItem?.name ?? (
            <Text color="text-500" fontStyle="italic">
              {hasItems ? placeholder : noItemsText}
            </Text>
          )}
        </Truncate>
        <SelectChevronUpDownIcon />
      </Button>
      <MenuContainer placement="bottom start" minHeight={0}>
        <Autocomplete filter={contains}>
          <MenuHeader>
            <SearchField aria-label={searchLabel} variant="quiet" autoFocus>
              <SearchIcon />
              <Input placeholder={searchLabel} />
            </SearchField>
          </MenuHeader>
          <Menu
            selectionMode="single"
            selectedKeys={selectedItem ? [selectedItem.id] : []}
            items={items}
            renderEmptyState={() => (
              <CompactEmptyState
                icon={<Icon svg={<Icons.Edit />} />}
                description={noMatchesText}
              />
            )}
            onAction={(key) => onSelect(String(key))}
          >
            {({ id, name }) => (
              <MenuItem id={id} textValue={name}>
                <Truncate maxLines={2} title={name}>
                  {name}
                </Truncate>
              </MenuItem>
            )}
          </Menu>
        </Autocomplete>
      </MenuContainer>
    </MenuTrigger>
  );
}
