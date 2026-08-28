import {
  Icon,
  Icons,
  SegmentedControl,
  SegmentedControlItem,
  Text,
} from "@phoenix/components";
import { isProviderThemeMode, useTheme } from "@phoenix/contexts";

/**
 * A compact segmented control for picking the theme mode: light, dark, or
 * system. Selecting "System" follows the OS preference.
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
    >
      <SegmentedControlItem id="light">
        <Icon svg={<Icons.Sun />} />
        <Text>Light</Text>
      </SegmentedControlItem>
      <SegmentedControlItem id="dark">
        <Icon svg={<Icons.Moon />} />
        <Text>Dark</Text>
      </SegmentedControlItem>
      <SegmentedControlItem id="system">
        <Icon svg={<Icons.HalfMoonHalfSun />} />
        <Text>System</Text>
      </SegmentedControlItem>
    </SegmentedControl>
  );
}
