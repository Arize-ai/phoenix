import { css } from "@emotion/react";

import {
  Icon,
  Icons,
  ToggleButton,
  ToggleButtonGroup,
} from "@phoenix/components";
import { isProviderThemeMode, useTheme } from "@phoenix/contexts";

const themeToggleCSS = css`
  width: 100%;
  & > .toggle-button {
    flex: 1 1 0;
    justify-content: center;
  }
`;

/**
 * A compact segmented control for picking the theme mode: light, dark, or
 * system. Selecting "System" follows the OS preference.
 */
export function ThemeToggle() {
  const { themeMode, setThemeMode } = useTheme();
  return (
    <ToggleButtonGroup
      size="S"
      aria-label="Theme"
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={[themeMode]}
      onSelectionChange={(keys) => {
        const selectedKey = Array.from(keys)[0];
        if (
          typeof selectedKey === "string" &&
          isProviderThemeMode(selectedKey)
        ) {
          setThemeMode(selectedKey);
        }
      }}
      css={themeToggleCSS}
      className="theme-toggle"
    >
      <ToggleButton id="light" leadingVisual={<Icon svg={<Icons.Sun />} />}>
        Light
      </ToggleButton>
      <ToggleButton id="dark" leadingVisual={<Icon svg={<Icons.Moon />} />}>
        Dark
      </ToggleButton>
      <ToggleButton
        id="system"
        leadingVisual={<Icon svg={<Icons.HalfMoonHalfSun />} />}
      >
        System
      </ToggleButton>
    </ToggleButtonGroup>
  );
}
