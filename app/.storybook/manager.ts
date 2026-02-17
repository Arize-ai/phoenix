import { addons } from "@storybook/manager-api";
import { themes } from "@storybook/theming";
import { create } from "@storybook/theming/create";

const THEME_CHANGE_EVENT = "phoenix:system-theme-change";

/**
 * Phoenix app background colors
 * @see app/src/GlobalStyles.tsx
 */
const PHOENIX_BACKGROUND = {
  light: "rgb(248, 248, 248)", // light theme gray-100
  dark: "rgb(29, 29, 29)", // dark theme gray-100
} as const;

/**
 * Custom Storybook themes that extend the built-in themes
 * with a matching preview background color
 */
const lightTheme = create({
  ...themes.light,
  base: "light",
  appPreviewBg: PHOENIX_BACKGROUND.light,
});

const darkTheme = create({
  ...themes.dark,
  base: "dark",
  appPreviewBg: PHOENIX_BACKGROUND.dark,
});

function getThemeForScheme(scheme: string) {
  return scheme === "dark" ? darkTheme : lightTheme;
}

function getSystemTheme() {
  return globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

// Set initial theme based on OS preference
addons.setConfig({
  // Disable keyboard shortcuts globally to prevent interference with
  // input fields in stories (e.g., pressing "1" in a search field
  // would otherwise trigger Storybook's "Go to Canvas" shortcut)
  enableShortcuts: false,
  theme: getThemeForScheme(getSystemTheme()),
});

// Listen for theme change events from the preview iframe (cross-iframe channel)
// and also watch the media query directly as a fallback.
addons.register("phoenix-auto-theme", (api) => {
  const applySystemTheme = (scheme: string) => {
    api.setOptions({ theme: getThemeForScheme(scheme) });
  };

  // Primary: listen for channel events emitted by the preview's useSystemTheme hook
  const channel = addons.getChannel();
  channel.on(THEME_CHANGE_EVENT, applySystemTheme);

  // Fallback: also listen to matchMedia directly in the manager frame
  const mq = globalThis.matchMedia?.("(prefers-color-scheme: dark)");
  if (mq) {
    mq.addEventListener("change", () => applySystemTheme(getSystemTheme()));
  }
});
