import type { ReactNode } from "react";
import { useState } from "react";
import { Autocomplete, Input, useFilter } from "react-aria-components";

import { Alert } from "@phoenix/components/core/alert";
import { Button } from "@phoenix/components/core/button";
import { CompactEmptyState } from "@phoenix/components/core/empty";
import { SearchField, SearchIcon } from "@phoenix/components/core/field";
import { Icon, Icons } from "@phoenix/components/core/icon";
import {
  Menu,
  MenuFooter,
  MenuHeader,
  MenuHeaderTitle,
  MenuItem,
} from "@phoenix/components/core/menu";
import { SwatchedName } from "@phoenix/components/core/swatchedName";

import type { TagGroupItem } from "./TagGroup";

export interface TagPickerProps {
  /**
   * Everything that can be attached, in the order the list shows it.
   */
  options: readonly TagGroupItem[];
  /**
   * The ids of the options attached now. The picker shows them checked.
   */
  selectedKeys: Iterable<string>;
  /**
   * Called with the whole new set whenever an option is checked or
   * unchecked.
   */
  onSelectionChange: (ids: Set<string>) => void;
  /**
   * The form that creates a new option. When it is given, the picker offers
   * "Create new label"; call `onDone` to come back to the list once the
   * option exists (and is attached, if it should be).
   */
  renderCreateForm?: (props: { onDone: () => void }) => ReactNode;
  /**
   * Shown beneath the list, such as a link to manage the options.
   */
  footer?: ReactNode;
  /**
   * Why the last change did not save.
   */
  error?: string | null;
}

function swatchColorOf(option: TagGroupItem): string {
  if (option.userColor !== undefined) {
    return option.userColor;
  }
  if (option.color !== undefined && option.color !== "neutral") {
    return `var(--global-color-${option.color}-500)`;
  }
  return "var(--global-color-gray-600)";
}

/**
 * The searchable checklist behind a set of tags: every option with its color
 * swatch, the attached ones checked, and an inline way to create a new one.
 * It knows nothing about where options come from or how a change is saved;
 * a domain wrapper loads the options and persists the selection. Render it
 * inside a popover, as `EditableTagGroup` does.
 */
export function TagPicker({
  options,
  selectedKeys,
  onSelectionChange,
  renderCreateForm,
  footer,
  error,
}: TagPickerProps) {
  const [mode, setMode] = useState<"apply" | "create">("apply");
  const { contains } = useFilter({ sensitivity: "base" });
  const noun = "label";
  const plural = "labels";
  return (
    <>
      {error ? <Alert variant="danger">{error}</Alert> : null}
      <MenuHeader>
        <MenuHeaderTitle
          leadingContent={
            mode === "create" ? (
              <Button
                variant="quiet"
                size="S"
                aria-label={`Back to ${plural}`}
                leadingVisual={<Icon svg={<Icons.ChevronLeftSmall />} />}
                onPress={() => setMode("apply")}
              />
            ) : undefined
          }
          trailingContent={
            mode === "apply" && renderCreateForm ? (
              <Button
                variant="quiet"
                size="S"
                aria-label={`Create new ${noun}`}
                leadingVisual={<Icon svg={<Icons.Plus />} />}
                onPress={() => setMode("create")}
              />
            ) : undefined
          }
        >
          {mode === "create" ? `Create new ${noun}` : `Assign ${plural}`}
        </MenuHeaderTitle>
      </MenuHeader>
      {mode === "create" && renderCreateForm ? (
        renderCreateForm({ onDone: () => setMode("apply") })
      ) : (
        <>
          <Autocomplete filter={contains}>
            <MenuHeader>
              <SearchField
                aria-label={`Search ${plural}`}
                variant="quiet"
                autoFocus
              >
                <SearchIcon />
                <Input placeholder={`Search ${plural}...`} />
              </SearchField>
            </MenuHeader>
            <Menu
              aria-label={plural}
              items={options}
              selectionMode="multiple"
              // Escape would otherwise clear the selection, detaching every
              // option at once
              escapeKeyBehavior="none"
              selectedKeys={new Set(selectedKeys)}
              onSelectionChange={(selection) => {
                onSelectionChange(
                  selection === "all"
                    ? new Set([
                        ...selectedKeys,
                        ...options.map((option) => option.id),
                      ])
                    : new Set([...selection].map(String))
                );
              }}
              renderEmptyState={() => (
                <CompactEmptyState
                  icon={<Icon svg={<Icons.PriceTags />} />}
                  description={`No ${plural}`}
                />
              )}
            >
              {(option) => (
                <MenuItem id={option.id} textValue={option.label}>
                  <SwatchedName
                    name={option.label}
                    color={swatchColorOf(option)}
                  />
                </MenuItem>
              )}
            </Menu>
          </Autocomplete>
          {footer ? <MenuFooter>{footer}</MenuFooter> : null}
        </>
      )}
    </>
  );
}
