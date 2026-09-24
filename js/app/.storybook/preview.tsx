import type { DocsContainerProps } from "@storybook/addon-docs/blocks";
import {
  Controls,
  Description,
  DocsContainer,
  Primary,
  Stories,
  Subtitle,
  Title,
  useOf,
} from "@storybook/addon-docs/blocks";
import type { Preview } from "@storybook/react";
import React, { useEffect, useMemo, useState } from "react";
import { UNSAFE_PortalProvider } from "react-aria/PortalProvider";
import { MemoryRouter } from "react-router";
import { GLOBALS_UPDATED, SET_GLOBALS } from "storybook/internal/core-events";
import { addons as previewAddons } from "storybook/preview-api";
import { CacheProvider, createCache, themes } from "storybook/theming";
import { create } from "storybook/theming/create";

import type { ProviderTheme } from "../src/contexts";
import { PreferencesProvider, ThemeProvider } from "../src/contexts";
import { GlobalStyles } from "../src/GlobalStyles";
import {
  THUMBNAIL_FRAME_TEST_ID,
  THUMBNAIL_HOVER_ATTRIBUTE,
  THUMBNAIL_SCALE_ATTRIBUTE,
  THUMBNAIL_SIZE,
  THUMBNAIL_STORY_NAME,
  type ThumbnailParameters,
} from "../stories/_meta/thumbnail";

export const THEME_CHANGE_EVENT = "phoenix:system-theme-change";

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

type GlobalsPayload = { globals?: { theme?: unknown } } | undefined;

function getThemeModeFromGlobals(payload: GlobalsPayload): string | undefined {
  const theme = payload?.globals?.theme;
  return typeof theme === "string" ? theme : undefined;
}

/**
 * The toolbar theme mode, read from Storybook's own globals events.
 *
 * `useGlobals` only works inside decorators, and a docs page renders a
 * decorator only when it embeds a story — an MDX page such as a subject
 * Overview embeds none. The preview emits `GLOBALS_UPDATED` before every docs
 * render and on every toolbar change regardless, and `channel.last` returns
 * the payload sent before this container mounted.
 */
function useDocsThemeMode(): string {
  const [themeMode, setThemeMode] = useState(() => {
    const channel = previewAddons.getChannel();
    return (
      getThemeModeFromGlobals(channel.last(GLOBALS_UPDATED)?.[0]) ??
      getThemeModeFromGlobals(channel.last(SET_GLOBALS)?.[0]) ??
      "auto"
    );
  });

  useEffect(() => {
    const channel = previewAddons.getChannel();
    const handler = (payload: GlobalsPayload) => {
      const next = getThemeModeFromGlobals(payload);
      if (next) {
        setThemeMode(next);
      }
    };
    channel.on(GLOBALS_UPDATED, handler);
    channel.on(SET_GLOBALS, handler);
    return () => {
      channel.off(GLOBALS_UPDATED, handler);
      channel.off(SET_GLOBALS, handler);
    };
  }, []);

  return themeMode;
}

/**
 * Custom DocsContainer that respects the toolbar theme selector while also
 * responding to system theme changes when "auto" or "both" is selected.
 */
/**
 * Storybook's default autodocs page with two changes. The Stories list leaves
 * out the primary story. The default includes it, so every docs page drew its
 * first story twice, once as the primary canvas and again at the head of the
 * list. With it excluded, a single-story file's docs page shows that story
 * once and a multi-story page lists only the stories below the primary one.
 * And the props table is omitted when the file sets
 * `parameters.controls.disable`.
 *
 * A file whose stories are peers, with no single representative instance,
 * sets `parameters.phoenixDocs.showPrimary: false`. The page then skips the
 * unlabeled primary canvas and lists every story under Stories, each with
 * its name as a heading.
 */
function DocsPage() {
  // Storybook's Controls block ignores `parameters.controls.disable`, which
  // only hides the canvas panel. Honor it here too, so a file whose args are
  // fixtures rather than reader choices shows no props table.
  const { preparedMeta } = useOf("meta", ["meta"]);
  const controlsDisabled = preparedMeta.parameters.controls?.disable === true;
  const showPrimary =
    preparedMeta.parameters.phoenixDocs?.showPrimary !== false;
  return (
    <>
      <Title />
      <Subtitle />
      <Description />
      {showPrimary ? <Primary /> : null}
      {controlsDisabled || !showPrimary ? null : <Controls />}
      <Stories includePrimary={!showPrimary} />
    </>
  );
}

function ThemedDocsContainer(props: DocsContainerProps) {
  const themeMode = useDocsThemeMode();
  const systemTheme = useSystemTheme();
  const effectiveTheme = getEffectiveTheme(themeMode, systemTheme);
  const docsTheme = getDocsTheme(themeMode, systemTheme);
  const docsCache = useMemo(
    () => createDocsEmotionCache(effectiveTheme),
    [effectiveTheme]
  );

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
 * The frame a `Thumbnail` story renders in, so its screenshot always has the
 * Overview card's aspect ratio. Content that overflows is clipped: the story
 * is authored to fit, and the frame is what gets photographed.
 *
 * `scale` never transforms anything. A scaled frame is laid out at
 * `1 / scale` times the thumbnail size in real CSS pixels, and the generator
 * photographs it at a proportionally lower pixel density, so the image is
 * always the same size. A CSS `transform` would shrink what the story
 * renders but not what it measures: React Aria would anchor overlays and
 * Recharts would size axes from scaled rectangles applied in unscaled units.
 *
 * The frame is also where overlays go. React Aria portals are re-homed into
 * it, and its (identity) `transform` makes it the containing block for their
 * fixed positioning, so an open popover, modal, or tooltip renders inside the
 * frame (and inside the story's theme) instead of against the window.
 * Children mount once the frame exists, so the first portal already has its
 * home.
 *
 * @see app/stories/_meta/thumbnail.ts
 */
function ThumbnailFrame({
  children,
  scale = 1,
  hover,
}: {
  children: React.ReactNode;
} & ThumbnailParameters) {
  const [frame, setFrame] = useState<HTMLDivElement | null>(null);
  return (
    <div
      ref={setFrame}
      data-testid={THUMBNAIL_FRAME_TEST_ID}
      {...{
        [THUMBNAIL_HOVER_ATTRIBUTE]: hover,
        [THUMBNAIL_SCALE_ATTRIBUTE]: scale,
      }}
      style={{
        alignItems: "center",
        backgroundColor: "var(--global-background-color-default)",
        boxSizing: "border-box",
        display: "flex",
        height: THUMBNAIL_SIZE.height / scale,
        justifyContent: "center",
        overflow: "hidden",
        padding: "var(--global-dimension-size-200)",
        position: "relative",
        transform: "translateZ(0)",
        width: THUMBNAIL_SIZE.width / scale,
      }}
    >
      {frame && (
        <UNSAFE_PortalProvider getContainer={() => frame}>
          {children}
        </UNSAFE_PortalProvider>
      )}
    </div>
  );
}

/**
 * Hook that resolves the toolbar theme selection to concrete theme(s) and
 * tracks system theme.
 */
function useResolvedThemes(themeMode: string) {
  const systemTheme = useSystemTheme(true);

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
      page: DocsPage,
      canvas: {
        withToolbar: false,
      },
    },
    options: {
      // MUST be an inline literal. Storybook statically parses this file to
      // read `options.storySort` — it never evaluates it — so an imported
      // constant fails the build with "Unexpected '<identifier>'".
      // `stories/_meta/taxonomy.ts` stays the declarative source of truth and
      // `pnpm lint:stories` asserts this array agrees with it.
      storySort: {
        order: [
          "Design System",
          [
            "Color",
            ["Overview"],
            "Typography",
            ["Overview"],
            "Layout",
            ["Overview"],
            "Icons",
            ["Overview"],
            "Actions",
            ["Overview"],
            "Forms",
            ["Overview"],
            "Overlays",
            ["Overview"],
            "Badges",
            ["Overview"],
            "Feedback",
            [
              "Overview",
              "*",
              "Empty states",
              ["Overview", "Empty State", "Empty State Graphic", "In Context"],
            ],
            "Errors",
            "Navigation",
            ["Overview"],
            "Tables",
            ["Overview"],
            "Data visualization",
            ["Overview"],
            "Dates and times",
            ["Overview"],
            "Code",
            ["Overview"],
            "Media",
            ["Overview"],
            "Drag and resize",
            ["Overview"],
          ],
          "Domains",
          [
            "Tracing",
            ["Overview"],
            "Experiments",
            ["Overview"],
            "Datasets",
            "Evaluators",
            "Annotations",
            ["Overview"],
            "Playground",
            ["Overview"],
            "Prompts",
            ["Overview"],
            "PXI",
            ["Overview"],
            "Cost",
            ["Overview"],
            "App shell",
            ["Overview"],
            "Auth",
            ["Overview"],
            "Settings",
            ["Overview"],
          ],
          "Storybook",
          ["Writing a story", "Tags", "Storybook frames", "Storybook health"],
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
    (Story, { globals, parameters, name }) => {
      const themeMode = globals.theme ?? "auto";
      const { resolvedThemes, systemTheme } = useResolvedThemes(themeMode);
      const isBoth = resolvedThemes.length > 1;
      const isThumbnail = name === THUMBNAIL_STORY_NAME;
      // A thumbnail owns its framing: no inset, no width mode, just the frame.
      const frame: ResolvedStoryFrame = isThumbnail
        ? { hasInset: false, width: "intrinsic" }
        : getStoryFrame(parameters);
      const thumbnail: ThumbnailParameters = parameters.thumbnail ?? {};
      const content = isThumbnail ? (
        <ThumbnailFrame {...thumbnail}>
          <Story />
        </ThumbnailFrame>
      ) : (
        <Story />
      );
      const themeLayout =
        parameters.themeLayout === "column" ? "column" : "row";

      if (!isBoth) {
        return (
          <div
            data-phoenix-story-root="true"
            style={{ display: "flex", minHeight: "100%", width: "100%" }}
          >
            <ThemedStory theme={resolvedThemes[0]} frame={frame}>
              {content}
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
                {content}
              </ThemedStory>
            </div>
          ))}
        </div>
      );
    },
  ],
};

export default preview;
