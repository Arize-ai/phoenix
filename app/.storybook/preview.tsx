import type { Preview } from "@storybook/react";
import { Provider, ProviderTheme } from "@arizeai/components";
import { GlobalStyles } from "../src/GlobalStyles";
import { ThemeProvider } from "../src/contexts";
import { MemoryRouter } from "react-router";
import React, { PropsWithChildren } from "react";

/**
 * A Component that renders a background for the story based on the theme
 * @returns
 */
function StoryBackground({
  children,
  padding,
}: {
  children: React.ReactNode;
  padding?: string;
}) {
  return (
    <div
      data-testid="story-background"
      style={{
        backgroundColor: "var(--ac-global-background-color-default)",
        padding: padding ?? "0",
      }}
    >
      {children}
    </div>
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
  },
  //👇 Enables auto-generated documentation for all stories
  tags: ["autodocs"],
  globalTypes: {
    theme: {
      description: "Global theme for components",
      toolbar: {
        // The label to show for this toolbar item
        title: "Theme",
        icon: "paintbrush",
        // Array of plain string values or MenuItem shape (see below)
        items: ["light", "dark", "all"],
        // Change title based on selected value
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    theme: window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light",
  },
  decorators: [
    // 👇 Defining the decorator in the preview file applies it to all stories
    (Story, { parameters, globals }) => {
      let themes: ProviderTheme[] = ["light"];
      if (globals.theme === "all") {
        themes = ["light", "dark"];
      } else {
        themes = [globals.theme];
      }

      const numThemes = themes.length;

      const contents = themes.map((theme) => (
        <Provider theme={theme} mountGlobalStyles={false}>
          <ThemeProvider theme={theme}>
            <MemoryRouter initialEntries={["/"]}>
              <GlobalStyles />
              <StoryBackground
                padding={
                  // Add padding to the story entries if we have multiple themes so that we can see a background color
                  numThemes < 1 ? "0" : "var(--ac-global-dimension-size-500)"
                }
              >
                <Story />
              </StoryBackground>
            </MemoryRouter>
          </ThemeProvider>
        </Provider>
      ));

      // If we only have one theme, we can just return the story
      if (numThemes === 1) {
        return contents[0];
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
          {contents.map((content, index) => (
            <li key={index} style={{ flex: 1 }}>
              {content}
            </li>
          ))}
        </ul>
      );
    },
  ],
};

export default preview;
