import React, { useCallback, useEffect } from "react";
import { addons, types, useGlobals } from "storybook/manager-api";
import { themes } from "storybook/theming";
import { create } from "storybook/theming/create";

const THEME_CHANGE_EVENT = "phoenix:system-theme-change";

/**
 * Phoenix design system background colors (gray-75)
 * @see app/src/GlobalStyles.tsx --global-background-color-default
 */
const PHOENIX_BACKGROUND = {
  light: "rgb(253, 253, 253)", // light theme gray-75
  dark: "rgb(14, 14, 14)", // dark theme gray-75
} as const;

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

const THEME_OPTIONS = [
  { value: "auto", label: "Auto" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "both", label: "Both" },
] as const;

function ThemeToolbar() {
  const [globals, updateGlobals] = useGlobals();
  const currentTheme = globals.theme ?? "auto";

  const applyManagerTheme = useCallback((mode: string) => {
    if (mode === "light") {
      addons.setConfig({ theme: lightTheme });
    } else if (mode === "dark") {
      addons.setConfig({ theme: darkTheme });
    } else {
      addons.setConfig({ theme: getThemeForScheme(getSystemTheme()) });
    }
  }, []);

  const handleClick = useCallback(
    (value: string) => {
      updateGlobals({ theme: value });
      applyManagerTheme(value);
    },
    [updateGlobals, applyManagerTheme]
  );

  useEffect(() => {
    applyManagerTheme(currentTheme);
  }, [currentTheme, applyManagerTheme]);

  return React.createElement(
    "div",
    {
      style: {
        alignItems: "center",
        display: "flex",
        fontSize: "12px",
        gap: "2px",
        height: "100%",
      },
    },
    React.createElement(
      "span",
      {
        style: {
          color: "inherit",
          marginRight: "4px",
          opacity: 0.7,
        },
      },
      "Theme:"
    ),
    THEME_OPTIONS.map(({ value, label }) =>
      React.createElement(
        "button",
        {
          key: value,
          onClick: () => handleClick(value),
          style: {
            background:
              currentTheme === value ? "rgba(2, 156, 253, 0.1)" : "transparent",
            border: "none",
            borderRadius: "4px",
            color: currentTheme === value ? "rgb(2, 156, 253)" : "inherit",
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: "12px",
            fontWeight: currentTheme === value ? 700 : 400,
            padding: "6px 10px",
          },
        },
        label
      )
    )
  );
}

addons.register("phoenix-theme-toolbar", () => {
  addons.add("phoenix-theme-toolbar/tool", {
    type: types.TOOL,
    title: "Theme",
    render: ThemeToolbar,
  });
});

// Set initial theme based on OS preference
addons.setConfig({
  enableShortcuts: false,
  theme: getThemeForScheme(getSystemTheme()),
});

// Listen for system theme changes when in "auto" mode
addons.register("phoenix-auto-theme", (api) => {
  const channel = addons.getChannel();

  const getThemeMode = () => api.getGlobals()?.theme ?? "auto";

  channel.on(THEME_CHANGE_EVENT, (scheme: string) => {
    const mode = getThemeMode();
    if (mode === "auto" || mode === "both") {
      addons.setConfig({ theme: getThemeForScheme(scheme) });
    }
  });

  const mq = globalThis.matchMedia?.("(prefers-color-scheme: dark)");
  if (mq) {
    mq.addEventListener("change", () => {
      const mode = getThemeMode();
      if (mode === "auto" || mode === "both") {
        addons.setConfig({ theme: getThemeForScheme(getSystemTheme()) });
      }
    });
  }
});
