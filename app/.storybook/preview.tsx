import type { DocsContainerProps } from "@storybook/addon-docs/blocks";
import { DocsContainer } from "@storybook/addon-docs/blocks";
import type { Preview } from "@storybook/react";
import React, { useEffect, useMemo, useState } from "react";
import { MemoryRouter } from "react-router";
import { addons as previewAddons } from "storybook/preview-api";
import { CacheProvider, createCache, themes } from "storybook/theming";
import { create } from "storybook/theming/create";

import type { ProviderTheme } from "../src/contexts";
import { PreferencesProvider, ThemeProvider } from "../src/contexts";
import { GlobalStyles } from "../src/GlobalStyles";

export const THEME_CHANGE_EVENT = "phoenix:system-theme-change";
export const THEME_MODE_CHANGE_EVENT = "phoenix:theme-mode-change";

/**
 * Phoenix design system background colors (gray-75)
 * @see app/src/GlobalStyles.tsx --global-background-color-default
 */
const PHOENIX_BACKGROUND = {
  light: "rgb(253, 253, 253)", // light theme gray-75
  dark: "rgb(14, 14, 14)", // dark theme gray-75
} as const;

const lightDocsTheme = create({
  ...themes.light,
  base: "light",
  appBg: PHOENIX_BACKGROUND.light,
  appContentBg: PHOENIX_BACKGROUND.light,
  appPreviewBg: PHOENIX_BACKGROUND.light,
});

const darkDocsTheme = create({
  ...themes.dark,
  base: "dark",
  appBg: PHOENIX_BACKGROUND.dark,
  appContentBg: PHOENIX_BACKGROUND.dark,
  appPreviewBg: PHOENIX_BACKGROUND.dark,
});

const darkModeQuery = "(prefers-color-scheme: dark)";
const previewInset = "var(--global-dimension-size-500)";
const defaultBoundedContentWidth = "780px";

type StorySurfaceLayout = "centered" | "padded" | "fullscreen";
type StoryContentMode = "intrinsic" | "bounded" | "fill" | "overflow";

const getSystemTheme = (): ProviderTheme =>
  window.matchMedia(darkModeQuery).matches ? "dark" : "light";

function getStorySurfaceLayout(layout: unknown): StorySurfaceLayout {
  if (layout === "centered" || layout === "padded" || layout === "fullscreen") {
    return layout;
  }
  return "padded";
}

function getStoryStageStyle(layout: StorySurfaceLayout): React.CSSProperties {
  const baseStyle: React.CSSProperties = {
    boxSizing: "border-box",
    minHeight: "100%",
    minWidth: 0,
    width: "100%",
  };

  if (layout === "fullscreen") {
    return baseStyle;
  }

  if (layout === "centered") {
    return {
      ...baseStyle,
      alignItems: "center",
      display: "flex",
      justifyContent: "center",
      padding: previewInset,
    };
  }

  return {
    ...baseStyle,
    padding: previewInset,
  };
}

function getStoryContentMode(
  contentMode: unknown,
  layout: StorySurfaceLayout
): StoryContentMode {
  if (
    contentMode === "intrinsic" ||
    contentMode === "bounded" ||
    contentMode === "fill" ||
    contentMode === "overflow"
  ) {
    return contentMode;
  }

  if (layout === "centered") {
    return "intrinsic";
  }

  return "fill";
}

function getContentMaxWidth(contentMaxWidth: unknown): string | undefined {
  if (typeof contentMaxWidth === "number") {
    return `${contentMaxWidth}px`;
  }

  if (typeof contentMaxWidth === "string") {
    return contentMaxWidth;
  }

  return undefined;
}

function getStoryContentStyle(
  contentMode: StoryContentMode,
  contentMaxWidth?: string
): React.CSSProperties {
  const baseStyle: React.CSSProperties = {
    boxSizing: "border-box",
    minWidth: 0,
  };

  if (contentMode === "intrinsic") {
    return {
      ...baseStyle,
      display: "inline-block",
      maxWidth: "100%",
    };
  }

  if (contentMode === "bounded") {
    return {
      ...baseStyle,
      marginInline: "auto",
      maxWidth: contentMaxWidth ?? defaultBoundedContentWidth,
      width: "100%",
    };
  }

  if (contentMode === "overflow") {
    return {
      ...baseStyle,
      minWidth: "max-content",
    };
  }

  return {
    ...baseStyle,
    width: "100%",
  };
}

function createDocsEmotionCache(theme: ProviderTheme) {
  return createCache({
    key: `phoenix-docs-${theme}`,
  });
}

/**
 * Hook that tracks the OS/browser color scheme preference.
 * Optionally emits a Storybook channel event so the manager can sync its theme.
 */
function useSystemTheme(emitToChannel = false): ProviderTheme {
  const [theme, setTheme] = useState<ProviderTheme>(getSystemTheme);

  useEffect(() => {
    const mq = window.matchMedia(darkModeQuery);
    const handler = () => {
      const next = getSystemTheme();
      setTheme(next);
      if (emitToChannel) {
        try {
          previewAddons.getChannel().emit(THEME_CHANGE_EVENT, next);
        } catch {
          // Channel may not be ready yet
        }
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [emitToChannel]);

  // Emit the initial theme once on mount (the change handler above handles updates)
  useEffect(() => {
    if (emitToChannel) {
      try {
        previewAddons.getChannel().emit(THEME_CHANGE_EVENT, theme);
      } catch {
        // Channel may not be ready yet
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally run only on mount
  }, []);

  return theme;
}

/** Resolves the effective theme for docs page. */
function getEffectiveTheme(
  themeMode: string,
  systemTheme: ProviderTheme
): ProviderTheme {
  if (themeMode === "light") return "light";
  if (themeMode === "dark") return "dark";
  // "auto" or "both" - use system theme
  return systemTheme;
}

/** Resolves the toolbar theme mode to a Storybook docs theme. */
function getDocsTheme(themeMode: string, systemTheme: ProviderTheme) {
  if (themeMode === "light") return lightDocsTheme;
  if (themeMode === "dark") return darkDocsTheme;
  // "auto" or "both" - use system theme
  return systemTheme === "dark" ? darkDocsTheme : lightDocsTheme;
}

/**
 * Custom DocsContainer that respects the toolbar theme selector while also
 * responding to system theme changes when "auto" or "both" is selected.
 *
 * Since useGlobals can't be used outside decorators, we listen for theme mode
 * changes via the Storybook channel (emitted by the decorator).
 */
function ThemedDocsContainer(props: DocsContainerProps) {
  const [themeMode, setThemeMode] = useState("auto");
  const systemTheme = useSystemTheme();
  const effectiveTheme = getEffectiveTheme(themeMode, systemTheme);
  const docsTheme = getDocsTheme(themeMode, systemTheme);
  const docsCache = useMemo(
    () => createDocsEmotionCache(effectiveTheme),
    [effectiveTheme]
  );

  useEffect(() => {
    const channel = previewAddons.getChannel();
    const handler = (mode: string) => setThemeMode(mode);
    channel.on(THEME_MODE_CHANGE_EVENT, handler);
    return () => channel.off(THEME_MODE_CHANGE_EVENT, handler);
  }, []);

  // Directly set background color on body to bypass Storybook theme caching
  useEffect(() => {
    document.body.style.backgroundColor = PHOENIX_BACKGROUND[effectiveTheme];
  }, [effectiveTheme]);

  return (
    <CacheProvider value={docsCache}>
      <DocsContainer {...props} theme={docsTheme} />
    </CacheProvider>
  );
}

/**
 * Renders a single story wrapped in theme providers, scoping theme CSS
 * via class names on the container div (not document.body).
 */
function ThemedStory({
  children,
  theme,
  layout,
  contentMode,
  contentMaxWidth,
}: {
  children: React.ReactNode;
  theme: ProviderTheme;
  layout: StorySurfaceLayout;
  contentMode: StoryContentMode;
  contentMaxWidth?: string;
}) {
  return (
    <ThemeProvider themeMode={theme} disableBodyTheme>
      <PreferencesProvider>
        <MemoryRouter initialEntries={["/"]}>
          <GlobalStyles />
          <div
            className={`theme theme--${theme}`}
            data-testid="story-surface"
            style={{
              backgroundColor: "var(--global-background-color-default)",
              boxSizing: "border-box",
              display: "flex",
              flex: 1,
              minHeight: "100%",
              minWidth: 0,
              overflow: "auto",
              width: "100%",
            }}
          >
            <div data-testid="story-stage" style={getStoryStageStyle(layout)}>
              <div
                data-testid="story-content"
                style={getStoryContentStyle(contentMode, contentMaxWidth)}
              >
                {children}
              </div>
            </div>
          </div>
        </MemoryRouter>
      </PreferencesProvider>
    </ThemeProvider>
  );
}

/**
 * Hook that resolves the toolbar theme selection to concrete theme(s),
 * emits theme mode to the channel, and tracks system theme.
 */
function useResolvedThemes(themeMode: string) {
  const systemTheme = useSystemTheme(true);

  useEffect(() => {
    try {
      previewAddons.getChannel().emit(THEME_MODE_CHANGE_EVENT, themeMode);
    } catch {
      // Channel may not be ready yet
    }
  }, [themeMode]);

  if (themeMode === "both") return ["light", "dark"] as ProviderTheme[];
  if (themeMode === "auto") return [systemTheme];
  return [themeMode as ProviderTheme];
}

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      disable: true,
    },
    docs: {
      container: ThemedDocsContainer,
    },
    options: {
      storySort: {
        order: [
          "Reference",
          "Core",
          [
            "Content",
            "Actions",
            "Forms",
            "Feedback",
            "Overlays",
            "Layout",
            "Navigation",
            "Media",
          ],
          "Charting",
          "DateTime",
          "Table",
          "Annotation",
          "Chat",
          "Experiment",
          "Prompt",
          "Tokens",
          "Trace",
        ],
      },
    },
  },
  //👇 Enables auto-generated documentation for all stories
  tags: ["autodocs"],
  globalTypes: {
    theme: {
      description: "Global theme for components",
    },
  },
  initialGlobals: {
    theme: "auto",
  },
  decorators: [
    (Story, { globals, parameters }) => {
      const themeMode = globals.theme ?? "auto";
      const resolvedThemes = useResolvedThemes(themeMode);
      const isBoth = resolvedThemes.length > 1;
      const layout = getStorySurfaceLayout(parameters.layout);
      const contentMode = getStoryContentMode(parameters.contentMode, layout);
      const contentMaxWidth = getContentMaxWidth(parameters.contentMaxWidth);
      const themeLayout = parameters.themeLayout ?? "row";

      if (!isBoth) {
        return (
          <div
            data-phoenix-story-root="true"
            style={{ display: "flex", minHeight: "100%", width: "100%" }}
          >
            <ThemedStory
              theme={resolvedThemes[0]}
              layout={layout}
              contentMode={contentMode}
              contentMaxWidth={contentMaxWidth}
            >
              <Story />
            </ThemedStory>
          </div>
        );
      }

      return (
        <div
          data-phoenix-story-root="true"
          style={{
            display: "flex",
            flexDirection: themeLayout,
            height: "100%",
            minHeight: "100%",
            width: "100%",
          }}
        >
          {resolvedThemes.map((theme) => (
            <div
              key={theme}
              style={{ display: "flex", flex: 1, minHeight: 0, minWidth: 0 }}
            >
              <ThemedStory
                theme={theme}
                layout={layout}
                contentMode={contentMode}
                contentMaxWidth={contentMaxWidth}
              >
                <Story />
              </ThemedStory>
            </div>
          ))}
        </div>
      );
    },
  ],
};

export default preview;
