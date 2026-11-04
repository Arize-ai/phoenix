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

export type DecisionMenuItem = {
  id: string;
  name: string;
};

/**
 * Picks a saved decision from a searchable menu, drawn like the playground's
 * prompt menu. Sits to the left of a {@link DecisionVersionSelector} in a
 * `CompositeField` once a decision is selected.
 */
export function DecisionMenu({
  decisions,
  selectedDecision,
  isDisabled,
  onSelectDecision,
}: {
  decisions: readonly DecisionMenuItem[];
  /** The selected decision; it need not be in `decisions`. */
  selectedDecision: DecisionMenuItem | null;
  isDisabled?: boolean;
  onSelectDecision: (decisionId: string) => void;
}) {
  const { contains } = useFilter({ sensitivity: "base" });
  const hasDecisions = decisions.length > 0;
  const emptyText = hasDecisions ? "Select a decision" : "No saved decisions";
  return (
    <MenuTrigger>
      <Button
        data-testid="decision-menu-button"
        size="S"
        className="left-child"
        isDisabled={isDisabled || !hasDecisions}
        data-has-selection={selectedDecision ? true : undefined}
        css={sourceMenuTriggerCSS}
      >
        <Truncate
          maxWidth="var(--text-max-width)"
          title={selectedDecision?.name}
        >
          {selectedDecision?.name ?? (
            <Text color="text-500" fontStyle="italic">
              {emptyText}
            </Text>
          )}
        </Truncate>
        <SelectChevronUpDownIcon />
      </Button>
      <MenuContainer placement="bottom start" minHeight={0}>
        <Autocomplete filter={contains}>
          <MenuHeader>
            <SearchField
              aria-label="Search decisions"
              variant="quiet"
              autoFocus
            >
              <SearchIcon />
              <Input placeholder="Search decisions" />
            </SearchField>
          </MenuHeader>
          <Menu
            selectionMode="single"
            selectedKeys={selectedDecision ? [selectedDecision.id] : []}
            items={decisions}
            renderEmptyState={() => (
              <CompactEmptyState
                icon={<Icon svg={<Icons.Edit />} />}
                description="No decisions"
              />
            )}
            onAction={(key) => onSelectDecision(String(key))}
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
