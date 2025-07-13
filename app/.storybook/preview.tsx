/** @jsx jsx */
import type { Preview } from "@storybook/react";
import React from "react";
import { jsx, css } from "@emotion/react";
import { Provider } from "@arizeai/components";
import { GlobalStyles } from "../src/GlobalStyles";
import { ThemeProvider } from "../src/contexts";
import { MemoryRouter } from "react-router";

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
        items: ["light", "dark", "both"],
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
      const theme = globals.theme || "light";

      if (theme === "both") {
        return (
          <div
            css={css`
              display: flex;
              gap: 2rem;
              min-height: 100vh;

              & > div {
                flex: 1;
                min-width: 0;
              }
            `}
          >
            <div>
              <Provider theme="light" mountGlobalStyles={false}>
                <ThemeProvider theme="light">
                  <MemoryRouter initialEntries={["/"]}>
                    <GlobalStyles />
                    <div
                      css={css`
                        background-color: var(
                          --ac-global-background-color-default
                        );
                        width: 100%;
                        height: 100%;
                        position: relative;
                      `}
                    >
                      <Story />
                    </div>
                  </MemoryRouter>
                </ThemeProvider>
              </Provider>
            </div>
            <div>
              <Provider theme="dark" mountGlobalStyles={false}>
                <ThemeProvider theme="dark">
                  <MemoryRouter initialEntries={["/"]}>
                    <GlobalStyles />
                    <div
                      css={css`
                        background-color: var(
                          --ac-global-background-color-default
                        );
                        width: 100%;
                        height: 100%;
                        position: relative;
                      `}
                    >
                      <Story />
                    </div>
                  </MemoryRouter>
                </ThemeProvider>
              </Provider>
            </div>
          </div>
        );
      }

      return (
        <Provider theme={theme} mountGlobalStyles={false}>
          <ThemeProvider theme={theme}>
            <MemoryRouter initialEntries={["/"]}>
              <GlobalStyles />
              <Story />
            </MemoryRouter>
          </ThemeProvider>
        </Provider>
      );
    },
  ],
};

export default preview;
