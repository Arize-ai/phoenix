import type { Key } from "react-aria-components";

import {
  Button,
  Icon,
  Icons,
  Menu,
  MenuContainer,
  MenuItem,
  MenuTrigger,
} from "@phoenix/components";

/**
 * A display preference of a table that can be switched on or off
 */
export interface TableViewSetting {
  id: string;
  label: string;
  isEnabled: boolean;
  onChange: (isEnabled: boolean) => void;
  isDisabled?: boolean;
}

/**
 * An options button at the end of a table's toolbar that opens a menu of
 * display preferences, each a checkable item, so they stay out of the toolbar
 * itself.
 */
export function TableViewSettingsButton({
  settings,
}: {
  settings: readonly TableViewSetting[];
}) {
  const disabledKeys = settings
    .filter(({ isDisabled }) => isDisabled)
    .map(({ id }) => id);
  const selectedKeys = settings
    .filter(({ isEnabled }) => isEnabled)
    .map(({ id }) => id);
  const onSelectionChange = (keys: "all" | Set<Key>) => {
    settings.forEach((setting) => {
      const isEnabled = keys === "all" || keys.has(setting.id);
      if (isEnabled !== setting.isEnabled) {
        setting.onChange(isEnabled);
      }
    });
  };
  return (
    <MenuTrigger>
      <Button
        aria-label="View settings"
        leadingVisual={<Icon svg={<Icons.Options />} />}
      />
      <MenuContainer placement="bottom end" minHeight={0} minWidth={200}>
        <Menu
          aria-label="View settings"
          items={settings}
          selectionMode="multiple"
          selectedKeys={selectedKeys}
          disabledKeys={disabledKeys}
          onSelectionChange={onSelectionChange}
          escapeKeyBehavior="none"
        >
          {({ id, label }) => (
            <MenuItem id={id} textValue={label}>
              {label}
            </MenuItem>
          )}
        </Menu>
      </MenuContainer>
    </MenuTrigger>
  );
}
