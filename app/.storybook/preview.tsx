import type { DocsContainerProps } from "@storybook/blocks";
import { DocsContainer } from "@storybook/blocks";
import { addons as previewAddons } from "@storybook/preview-api";
import type { Preview } from "@storybook/react";
import { themes } from "@storybook/theming";
import React, { useEffect, useState } from "react";
import { MemoryRouter } from "react-router";

import type { ProviderTheme } from "../src/contexts";
import { PreferencesProvider, ThemeProvider } from "../src/contexts";
import { GlobalStyles } from "../src/GlobalStyles";

export const THEME_CHANGE_EVENT = "phoenix:system-theme-change";
export const THEME_MODE_CHANGE_EVENT = "phoenix:theme-mode-change";

const darkModeQuery = "(prefers-color-scheme: dark)";
const getSystemTheme = (): ProviderTheme =>
  window.matchMedia(darkModeQuery).matches ? "dark" : "light";

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

/** Resolves the toolbar theme mode to a Storybook docs theme. */
function useDocsTheme(themeMode: string) {
  const systemTheme = useSystemTheme();
  if (themeMode === "light") return themes.light;
  if (themeMode === "dark") return themes.dark;
  // "auto" or "both" - use system theme
  return systemTheme === "dark" ? themes.dark : themes.light;
}

/**
 * Custom DocsContainer that respects the toolbar theme selector while also
 * responding to system theme changes when "auto" is selected.
 *
 * Since useGlobals can't be used outside decorators, we listen for theme mode
 * changes via the Storybook channel (emitted by the decorator).
 */
function ThemedDocsContainer(props: DocsContainerProps) {
  const [themeMode, setThemeMode] = useState("auto");
  const docsTheme = useDocsTheme(themeMode);

  useEffect(() => {
    const channel = previewAddons.getChannel();
    const handler = (mode: string) => setThemeMode(mode);
    channel.on(THEME_MODE_CHANGE_EVENT, handler);
    return () => channel.off(THEME_MODE_CHANGE_EVENT, handler);
  }, []);

  return <DocsContainer {...props} theme={docsTheme} />;
}

/**
 * Renders a single story wrapped in theme providers, scoping theme CSS
 * via class names on the container div (not document.body).
 */
function ThemedStory({
  children,
  theme,
  padding,
}: {
  children: React.ReactNode;
  theme: ProviderTheme;
  padding?: string;
}) {
  return (
    <ThemeProvider themeMode={theme} disableBodyTheme>
      <PreferencesProvider>
        <MemoryRouter initialEntries={["/"]}>
          <GlobalStyles />
          <div
            className={`theme theme--${theme}`}
            data-testid="story-background"
            style={{
              backgroundColor: "var(--global-background-color-default)",
              padding: padding ?? "0",
            }}
          >
            {children}
          </div>
        </MemoryRouter>
      </PreferencesProvider>
    </ThemeProvider>
  );
}

/**
 * Resolves the toolbar theme selection to concrete theme(s) and renders
 * the story in the appropriate wrapper(s).
 */
function StoryWithTheme({
  Story,
  themeMode,
}: {
  Story: React.ComponentType;
  themeMode: string;
}) {
  // Pass true to emit system theme changes to the manager
  const systemTheme = useSystemTheme(true);

  // Emit theme mode to the channel so DocsContainer can pick it up
  useEffect(() => {
    try {
      previewAddons.getChannel().emit(THEME_MODE_CHANGE_EVENT, themeMode);
    } catch {
      // Channel may not be ready yet
    }
  }, [themeMode]);

  let resolvedThemes: ProviderTheme[];
  if (themeMode === "both") {
    resolvedThemes = ["light", "dark"];
  } else if (themeMode === "auto") {
    resolvedThemes = [systemTheme];
  } else {
    resolvedThemes = [themeMode as ProviderTheme];
  }

  const isBoth = resolvedThemes.length > 1;
  const padding = isBoth ? "var(--global-dimension-size-500)" : "0";

  if (!isBoth) {
    return (
      <ThemedStory theme={resolvedThemes[0]} padding={padding}>
        <Story />
      </ThemedStory>
    );
  }

  return (
    <ul
      style={{
        display: "flex",
        flexDirection: "row",
        width: "100%",
        height: "100%",
      }}
    >
      {resolvedThemes.map((theme) => (
        <li key={theme} style={{ flex: 1 }}>
          <ThemedStory theme={theme} padding={padding}>
            <Story />
          </ThemedStory>
        </li>
      ))}
    </ul>
  );
}

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    docs: {
      container: ThemedDocsContainer,
    },
  },
  //👇 Enables auto-generated documentation for all stories
  tags: ["autodocs"],
  globalTypes: {
    theme: {
      description: "Global theme for components",
      toolbar: {
        title: "Theme",
        icon: "paintbrush",
        items: [
          { value: "auto", title: "Auto" },
          { value: "light", title: "Light" },
          { value: "dark", title: "Dark" },
          { value: "both", title: "Both" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    theme: "auto",
  },
  decorators: [
    (Story, { globals }) => {
      const themeMode = globals.theme ?? "auto";
      return <StoryWithTheme Story={Story} themeMode={themeMode} />;
    },
  ],
};

export default preview;
