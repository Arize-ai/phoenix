import type { Preview } from "@storybook/react";
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
        items: ["light", "dark"],
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
