import type { ReactNode } from "react";

import {
  Icon,
  Icons,
  SegmentedControl,
  SegmentedControlItem,
  Tooltip,
  TooltipTrigger,
} from "@phoenix/components";
import type { ProviderThemeMode } from "@phoenix/contexts";
import { isProviderThemeMode, useTheme } from "@phoenix/contexts";

const THEME_MODE_OPTIONS: {
  id: ProviderThemeMode;
  label: string;
  icon: ReactNode;
}[] = [
  { id: "light", label: "Light", icon: <Icons.Sun /> },
  { id: "dark", label: "Dark", icon: <Icons.Moon /> },
  { id: "sunshine", label: "Sunshine", icon: <Icons.Sparkles /> },
  { id: "system", label: "System", icon: <Icons.HalfMoonHalfSun /> },
];

/**
 * A compact segmented control for picking the theme mode: light, dark,
 * sunshine (a golden variant of light), or system. Selecting "System" follows
 * the OS preference. Segments are icon-only so four modes fit in the account
 * menu; each names its mode in an aria-label and a tooltip.
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
      {THEME_MODE_OPTIONS.map(({ id, label, icon }) => (
        <TooltipTrigger key={id} delay={100}>
          <SegmentedControlItem id={id} aria-label={label}>
            <Icon svg={icon} />
          </SegmentedControlItem>
          <Tooltip>{label}</Tooltip>
        </TooltipTrigger>
      ))}
    </SegmentedControl>
  );
}
