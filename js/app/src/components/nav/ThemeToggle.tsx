import { css } from "@emotion/react";

import {
  Icon,
  Icons,
  SegmentedControl,
  SegmentedControlItem,
  Text,
} from "@phoenix/components";
import { isProviderThemeMode, useTheme } from "@phoenix/contexts";

/**
 * Four labelled segments do not fit at equal widths in the account menu, so
 * each segment starts from its label's width and shares the leftover space.
 */
const themeToggleCSS = css`
  &[data-justified="true"] .segmented-control__item {
    flex: 1 0 auto;
  }
`;

/**
 * A compact segmented control for picking the theme mode: light, dark,
 * sunshine (a golden variant of light), or system. Selecting "System" follows
 * the OS preference.
 */
export function ThemeToggle() {
  const { themeMode, setThemeMode } = useTheme();
  return (
    <SegmentedControl
      size="S"
      aria-label="Theme"
      isJustified
      selectedKey={themeMode}
      onSelectionChange={(selectedKey) => {
        if (
          typeof selectedKey === "string" &&
          isProviderThemeMode(selectedKey)
        ) {
          setThemeMode(selectedKey);
        }
      }}
      className="theme-toggle"
      css={themeToggleCSS}
    >
      <SegmentedControlItem id="light">
        <Icon svg={<Icons.Sun />} />
        <Text>Light</Text>
      </SegmentedControlItem>
      <SegmentedControlItem id="dark">
        <Icon svg={<Icons.Moon />} />
        <Text>Dark</Text>
      </SegmentedControlItem>
      <SegmentedControlItem id="sunshine">
        <Icon svg={<Icons.Sparkles />} />
        <Text>Sunshine</Text>
      </SegmentedControlItem>
      <SegmentedControlItem id="system">
        <Icon svg={<Icons.HalfMoonHalfSun />} />
        <Text>System</Text>
      </SegmentedControlItem>
    </SegmentedControl>
  );
}
