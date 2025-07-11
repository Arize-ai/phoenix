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
function StoryBackground() {
  return (
    <div
      data-testid="story-background"
      style={{
        backgroundColor: "var(--ac-global-background-color-default)",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        position: "relative",
      }}
    />
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

      const contents = themes.map((theme) => (
        <div
          key={theme}
          style={{ width: "100%", height: "100%", position: "absolute" }}
        >
          <Provider theme={theme} mountGlobalStyles={false}>
            <ThemeProvider theme={theme}>
              <MemoryRouter initialEntries={["/"]}>
                <GlobalStyles />
                <StoryBackground />
                <Story />
              </MemoryRouter>
            </ThemeProvider>
          </Provider>
        </div>
      ));
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            gap: "2rem",
            width: "100%",
            height: "100%",
            minHeight: globals.theme === "all" ? "100vh" : "auto",
          }}
        >
          {contents}
        </div>
      );
    },
  ],
};

export default preview;
