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
type StoryWidthKeyword = "intrinsic" | "fill";
type ResolvedStoryWidth = StoryWidthKeyword | "bounded" | "overflow";

type ResolvedStoryFrame = {
  hasInset: boolean;
  width: ResolvedStoryWidth;
  maxWidth?: string;
};

const getSystemTheme = (): ProviderTheme =>
  window.matchMedia(darkModeQuery).matches ? "dark" : "light";

function getLegacyStorySurfaceLayout(
  layout: unknown
): StorySurfaceLayout | undefined {
  if (layout === "centered" || layout === "padded" || layout === "fullscreen") {
    return layout;
  }
  return undefined;
}

function getStoryStageStyle({
  hasInset,
  width,
}: Pick<ResolvedStoryFrame, "hasInset" | "width">): React.CSSProperties {
  const baseStyle: React.CSSProperties = {
    boxSizing: "border-box",
    minHeight: "100%",
    minWidth: 0,
    width: "100%",
  };

  if (width === "intrinsic") {
    return {
      ...baseStyle,
      alignItems: "center",
      display: "flex",
      justifyContent: "center",
      padding: hasInset ? previewInset : 0,
    };
  }

  if (!hasInset) {
    return baseStyle;
  }

  return {
    ...baseStyle,
    padding: previewInset,
  };
}

function getStoryInset(
  inset: unknown,
  legacyLayout?: StorySurfaceLayout
): boolean {
  if (typeof inset === "boolean") {
    return inset;
  }

  return legacyLayout !== "fullscreen";
}

function getExplicitStoryWidth(
  width: unknown
): Pick<ResolvedStoryFrame, "width" | "maxWidth"> | undefined {
  if (width === "intrinsic" || width === "fill") {
    return { width };
  }

  if (typeof width === "number") {
    return {
      width: "bounded",
      maxWidth: `${width}px`,
    };
  }

  if (typeof width === "string") {
    const trimmedWidth = width.trim();

    if (!trimmedWidth) {
      return undefined;
    }

    if (trimmedWidth === "intrinsic" || trimmedWidth === "fill") {
      return { width: trimmedWidth };
    }

    return {
      width: "bounded",
      maxWidth: trimmedWidth,
    };
  }

  return undefined;
}

function getLegacyStoryWidth({
  contentMode,
  contentMaxWidth,
  legacyLayout,
}: {
  contentMode: unknown;
  contentMaxWidth: unknown;
  legacyLayout?: StorySurfaceLayout;
}): Pick<ResolvedStoryFrame, "width" | "maxWidth"> {
  if (
    contentMode === "intrinsic" ||
    contentMode === "fill" ||
    contentMode === "overflow"
  ) {
    return { width: contentMode };
  }

  if (contentMode === "bounded") {
    return {
      width: "bounded",
      maxWidth:
        getContentMaxWidth(contentMaxWidth) ?? defaultBoundedContentWidth,
    };
  }

  if (legacyLayout === "padded" || legacyLayout === "fullscreen") {
    return { width: "fill" };
  }

  return { width: "intrinsic" };
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

function getStoryFrame(parameters: {
  inset?: unknown;
  width?: unknown;
  layout?: unknown;
  contentMode?: unknown;
  contentMaxWidth?: unknown;
}): ResolvedStoryFrame {
  const legacyLayout = getLegacyStorySurfaceLayout(parameters.layout);
  const explicitWidth = getExplicitStoryWidth(parameters.width);
  const legacyWidth = getLegacyStoryWidth({
    contentMode: parameters.contentMode,
    contentMaxWidth: parameters.contentMaxWidth,
    legacyLayout,
  });

  return {
    hasInset: getStoryInset(parameters.inset, legacyLayout),
    ...(explicitWidth ?? legacyWidth),
  };
}

function getStoryContentStyle(
  width: ResolvedStoryWidth,
  maxWidth?: string
): React.CSSProperties {
  const baseStyle: React.CSSProperties = {
    boxSizing: "border-box",
    minWidth: 0,
  };

  if (width === "intrinsic") {
    return {
      ...baseStyle,
      display: "inline-block",
      maxWidth: "100%",
    };
  }

  if (width === "bounded") {
    return {
      ...baseStyle,
      marginInline: "auto",
      maxWidth: maxWidth ?? defaultBoundedContentWidth,
      width: "100%",
    };
  }

  if (width === "overflow") {
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
  frame,
}: {
  children: React.ReactNode;
  theme: ProviderTheme;
  frame: ResolvedStoryFrame;
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
            <div data-testid="story-stage" style={getStoryStageStyle(frame)}>
              <div
                data-testid="story-content"
                style={getStoryContentStyle(frame.width, frame.maxWidth)}
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

  if (themeMode === "both") {
    return {
      resolvedThemes: ["light", "dark"] as ProviderTheme[],
      systemTheme,
    };
  }
  if (themeMode === "auto") {
    return { resolvedThemes: [systemTheme], systemTheme };
  }
  return {
    resolvedThemes: [themeMode as ProviderTheme],
    systemTheme,
  };
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
      canvas: {
        withToolbar: false,
      },
    },
    options: {
      storySort: {
        order: [
          "Detail panel",
          "Reference",
          ["Storybook frames", "Lines: border, divider"],
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
      const { resolvedThemes, systemTheme } = useResolvedThemes(themeMode);
      const isBoth = resolvedThemes.length > 1;
      const frame = getStoryFrame(parameters);
      const themeLayout =
        parameters.themeLayout === "column" ? "column" : "row";

      if (!isBoth) {
        return (
          <div
            data-phoenix-story-root="true"
            style={{ display: "flex", minHeight: "100%", width: "100%" }}
          >
            <ThemedStory theme={resolvedThemes[0]} frame={frame}>
              <Story />
            </ThemedStory>
          </div>
        );
      }

      return (
        <div
          data-phoenix-story-root="true"
          style={{
            backgroundColor: PHOENIX_BACKGROUND[systemTheme],
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
              <ThemedStory theme={theme} frame={frame}>
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
