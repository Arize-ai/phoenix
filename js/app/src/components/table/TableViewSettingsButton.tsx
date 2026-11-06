import { css } from "@emotion/react";

import {
  Button,
  Dialog,
  DialogTrigger,
  Icon,
  Icons,
  Popover,
  Switch,
} from "@phoenix/components";

/**
 * A display preference of a table that can be switched on or off
 */
export interface TableViewSetting {
  id: string;
  label: string;
  isEnabled: boolean;
  onChange: (isEnabled: boolean) => void;
}

/**
 * Matches a menu: the same width, padding, and item spacing, with each setting
 * a full-width row that reads like a menu item: the label on the left, the
 * switch on the right, and the whole row as the hit area.
 */
const tableViewSettingsCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-menu-item-gap);
  min-width: 250px;
  padding: var(--global-menu-item-gap);

  .table-view-settings__switch {
    width: 100%;
    box-sizing: border-box;
    justify-content: space-between;
    gap: var(--global-menu-split-item-content-gap);
    padding: var(--global-dimension-size-100);
    border-radius: var(--global-rounding-small);

    &[data-hovered],
    &[data-focus-visible] {
      background-color: var(--global-menu-item-background-color-hover);
    }
  }
`;

/**
 * An options button at the end of a table's toolbar that opens a popover of
 * display preferences, each a labeled switch, so they stay out of the toolbar
 * itself.
 */
export function TableViewSettingsButton({
  settings,
}: {
  settings: readonly TableViewSetting[];
}) {
  return (
    <DialogTrigger>
      <Button
        aria-label="View settings"
        leadingVisual={<Icon svg={<Icons.Options />} />}
      />
      <Popover placement="bottom end">
        <Dialog aria-label="View settings">
          <div css={tableViewSettingsCSS}>
            {settings.map(({ id, label, isEnabled, onChange }) => (
              <Switch
                key={id}
                className="table-view-settings__switch"
                labelPlacement="start"
                isSelected={isEnabled}
                onChange={onChange}
              >
                {label}
              </Switch>
            ))}
          </div>
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}
