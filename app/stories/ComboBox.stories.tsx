import React from "react";
import { Meta, StoryFn } from "@storybook/react";
import { ThemeProvider as EmotionThemeProvider } from "@emotion/react";

import { Provider, theme } from "@arizeai/components";

import {
  ComboBox,
  ComboBoxItem,
  ComboBoxProps,
} from "@phoenix/components/comobox/ComboBox";
import { ThemeProvider, useTheme } from "@phoenix/contexts";
import { GlobalStyles } from "@phoenix/GlobalStyles";

import { ThemeToggleWrap } from "./components/ThemeToggleWrap";

const meta: Meta = {
  title: "ComboBox",
  component: ComboBox,
  argTypes: {
    children: {
      control: {
        type: "text",
        default: "Label",
      },
    },
  },
  parameters: {
    controls: { expanded: true },
  },
};

export default meta;

function ComboBoxContent(props: ComboBoxProps<object>) {
  const { theme: componentsTheme } = useTheme();
  return (
    <Provider theme={componentsTheme}>
      <EmotionThemeProvider theme={theme}>
        <GlobalStyles />
        <ThemeToggleWrap>
          <ComboBox {...props}>
            <ComboBoxItem textValue="chocolate" key={"chocolate"}>
              Chocolate
            </ComboBoxItem>
            <ComboBoxItem textValue="mint" key={"mint"}>
              Mint
            </ComboBoxItem>
            <ComboBoxItem textValue="strawberry" key={"strawberry"}>
              Strawberry
            </ComboBoxItem>
            <ComboBoxItem textValue="vanilla" key={"vanilla"}>
              Vanilla
            </ComboBoxItem>
          </ComboBox>
        </ThemeToggleWrap>
      </EmotionThemeProvider>
    </Provider>
  );
}

const Template: StoryFn<ComboBoxProps<object>> = (args) => (
  <ThemeProvider>
    <ComboBoxContent {...args} />
  </ThemeProvider>
);

export const Default = Template.bind({});

Default.args = {
  label: "Ice cream flavor",
};
