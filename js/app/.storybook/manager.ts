import React, { useCallback, useEffect } from "react";
import type { API_HashEntry } from "storybook/internal/types";
import {
  addons,
  types,
  useGlobals,
  useStorybookApi,
} from "storybook/manager-api";
import { themes } from "storybook/theming";
import { create } from "storybook/theming/create";

import { usage } from "../stories/_meta/tags";
import { installRootHeadings } from "./sidebar/rootHeadings";
import { installSearchDocsTitles } from "./sidebar/searchDocsTitles";
import { installSubjectOverviews } from "./sidebar/subjectOverviews";

const THEME_CHANGE_EVENT = "phoenix:system-theme-change";

/**
 * Phoenix design system background colors (gray-75)
 * @see app/src/GlobalStyles.tsx --global-background-color-default
 */
const PHOENIX_BACKGROUND = {
  light: "rgb(253, 253, 253)", // light theme gray-75
  dark: "rgb(14, 14, 14)", // dark theme gray-75
} as const;

/**
 * Chip colors, as `r, g, b` triples per manager theme.
 *
 * The manager runs in its own iframe and cannot read the Phoenix CSS custom
 * properties, which are defined in the preview, so the color is hardcoded per
 * theme, mirroring the Phoenix token it comes from.
 *
 * `1000` is the step with good contrast against its own theme's background
 * because the ramps invert between themes, so one triple serves as both the
 * chip text color and, at low alpha, its fill.
 *
 * @see app/src/GlobalStyles.tsx
 */
const CHIP_COLORS = {
  // --global-color-red-1000 (light #b40000)
  danger: { light: "180, 0, 0", dark: "255, 158, 140" },
} as const;

type ChipRole = keyof typeof CHIP_COLORS;

/**
 * Text colour for a chip whose fill is opaque (selected rows only).
 *
 * Fixed pigments rather than theme-aware tokens, because the thing they sit on
 * is the chip's own role colour: dark in the light theme, light in the dark
 * theme. Near-black mirrors `--global-color-gray-75` in dark.
 */
const CHIP_ON_SOLID = {
  light: "rgb(255, 255, 255)",
  dark: "rgb(14, 14, 14)",
} as const;

/**
 * Only `unused` is chipped. The provenance, completeness and review axes stay
 * queryable through the Tag filters menu but are not drawn in the sidebar.
 */
const CHIP_ROLE_BY_TAG: Readonly<Record<string, ChipRole>> = {
  [usage.unused]: "danger",
};

const CHIP_TAG_ORDER: readonly string[] = [usage.unused];

const CHIP_STYLE_ELEMENT_ID = "phoenix-sidebar-chip-styles";
const SIDEBAR_THEME_ATTRIBUTE = "data-phoenix-sidebar-theme";

/**
 * Chips are styled by class, not by inline style, so a theme change repaints
 * them through CSS. `renderLabel` is not re-invoked when the manager theme
 * changes, so inline colors would go stale until the sidebar happened to
 * re-render.
 */
function ensureChipStyles() {
  if (document.getElementById(CHIP_STYLE_ELEMENT_ID)) {
    return;
  }
  const rules = (Object.keys(CHIP_COLORS) as ChipRole[]).flatMap((role) =>
    (["light", "dark"] as const).flatMap((mode) => [
      `
        [${SIDEBAR_THEME_ATTRIBUTE}="${mode}"] .phoenix-chip--${role} {
          color: rgb(${CHIP_COLORS[role][mode]});
          background: rgba(${CHIP_COLORS[role][mode]}, 0.16);
        }`,
      /*
       * A selected row is filled with the accent blue in BOTH manager themes,
       * so a chip's usual translucent fill disappears into it and the role
       * colour is lost. Over the selection the chip keeps its colour as an
       * OPAQUE fill instead, with the text switching to whichever fixed
       * pigment contrasts against it: the role colours are dark in the light
       * theme and light in the dark theme, so this is white over light-theme
       * chips and near-black over dark-theme ones.
       */
      `
        [${SIDEBAR_THEME_ATTRIBUTE}="${mode}"]
        .sidebar-item[data-selected="true"] .phoenix-chip--${role} {
          color: ${CHIP_ON_SOLID[mode]};
          background: rgb(${CHIP_COLORS[role][mode]});
        }`,
    ])
  );
  const style = document.createElement("style");
  style.id = CHIP_STYLE_ELEMENT_ID;
  style.textContent = `
    .phoenix-chip-row {
      display: flex;
      flex-wrap: wrap;
      gap: 3px;
      margin-top: 2px;
    }
    .phoenix-chip {
      border-radius: 3px;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.02em;
      line-height: 1.4;
      padding: 0 4px;
      text-transform: lowercase;
      white-space: nowrap;
    }
    ${rules.join("\n")}
  `;
  document.head.appendChild(style);
}

function applySidebarTheme(mode: string) {
  const resolved =
    mode === "light" || mode === "dark" ? mode : getSystemTheme();
  document.documentElement.setAttribute(SIDEBAR_THEME_ATTRIBUTE, resolved);
}

/**
 * Sidebar label: the entry name on its own line, its tag chips on the next.
 *
 * Storybook's sidebar already supports multi-line labels — `commonNodeStyles`
 * uses `minHeight: 28` with `align-items: start` and `word-break: break-word`,
 * and sets no `white-space: nowrap` or `text-overflow` — so long names wrap
 * rather than truncate and a taller row is expected. Stacking the chips below
 * the name means nothing has to shrink and the chips stay legible at any
 * sidebar width.
 *
 * Only leaf entries are chipped. `renderLabel` is also invoked for root and
 * branch nodes, which would otherwise pick up chips they have no tags for.
 */
function renderSidebarLabel(item: API_HashEntry) {
  if (item.type !== "story" && item.type !== "docs") {
    return item.name;
  }
  const tags = item.tags ?? [];
  const chips = CHIP_TAG_ORDER.filter((tag) => tags.includes(tag));
  if (chips.length === 0) {
    return item.name;
  }
  return React.createElement(
    "span",
    { style: { display: "flex", flexDirection: "column", minWidth: 0 } },
    React.createElement("span", null, item.name),
    React.createElement(
      "span",
      { className: "phoenix-chip-row" },
      chips.map((tag) =>
        React.createElement(
          "span",
          {
            key: tag,
            className: `phoenix-chip phoenix-chip--${CHIP_ROLE_BY_TAG[tag]}`,
          },
          tag
        )
      )
    )
  );
}

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

function getThemeForMode(mode: string) {
  if (mode === "light") {
    return lightTheme;
  }
  if (mode === "dark") {
    return darkTheme;
  }
  return getThemeForScheme(getSystemTheme());
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
  const api = useStorybookApi();
  const currentTheme = globals.theme ?? "both";

  const applyManagerTheme = useCallback(
    (mode: string) => {
      applySidebarTheme(mode);
      api.setOptions({ theme: getThemeForMode(mode) });
    },
    [api]
  );

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

/**
 * Sidebar config must go through `addons.setConfig`, NOT `api.setOptions`.
 *
 * The index hash is built in manager-api from
 * `const { sidebar = {} } = provider.getConfig()`, and `provider.getConfig()`
 * returns `addons.getConfig()` — the object `setConfig` assigns into.
 * `api.setOptions` only feeds layout and UI state, so a `sidebar` key passed
 * there is silently ignored.
 *
 * It also has to be set at module load: `renderLabel` is destructured once
 * while the hash is built and attached to each entry, so setting it later has
 * no effect on entries already created.
 */
ensureChipStyles();
installRootHeadings({
  themeAttribute: SIDEBAR_THEME_ATTRIBUTE,
  textColor: { light: lightTheme.textColor, dark: darkTheme.textColor },
});
applySidebarTheme("both");
installSearchDocsTitles();

addons.setConfig({
  sidebar: {
    renderLabel: renderSidebarLabel,
  },
});

addons.register("phoenix-subject-overviews", installSubjectOverviews);

addons.register("phoenix-manager-options", (api) => {
  const mode = api.getGlobals()?.theme ?? "both";
  applySidebarTheme(mode);
  api.setOptions({
    enableShortcuts: false,
    theme: getThemeForMode(mode),
  });
});

// Listen for system theme changes when in "auto" mode
addons.register("phoenix-auto-theme", (api) => {
  const channel = addons.getChannel();

  const getThemeMode = () => api.getGlobals()?.theme ?? "both";

  channel.on(THEME_CHANGE_EVENT, (scheme: string) => {
    const mode = getThemeMode();
    if (mode === "auto" || mode === "both") {
      document.documentElement.setAttribute(SIDEBAR_THEME_ATTRIBUTE, scheme);
      api.setOptions({ theme: getThemeForScheme(scheme) });
    }
  });

  const mq = globalThis.matchMedia?.("(prefers-color-scheme: dark)");
  if (mq) {
    mq.addEventListener("change", () => {
      const mode = getThemeMode();
      if (mode === "auto" || mode === "both") {
        applySidebarTheme(mode);
        api.setOptions({ theme: getThemeForScheme(getSystemTheme()) });
      }
    });
  }
});
