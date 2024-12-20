import React from "react";
import { Meta, StoryFn } from "@storybook/react";
import { css } from "@emotion/react";

import { Button as LegacyButton, Icon, Icons } from "@arizeai/components";

import { Button, ButtonProps } from "@phoenix/components/button/Button";

import { ThemeWrapper } from "./components/ThemeWrapper";

const meta: Meta = {
  title: "Button",
  component: Button,
  argTypes: {
    label: {
      control: {
        type: "text",
        default: "Label",
      },
    },
    isDisabled: {
      type: "boolean",
    },
    description: {
      type: "string",
      control: {
        type: "text",
      },
    },
    errorMessage: {
      type: "string",
      control: {
        type: "text",
      },
    },
    isInvalid: {
      control: {
        type: "boolean",
      },
    },
    isRequired: {
      control: {
        type: "boolean",
      },
    },
    menuTrigger: {
      options: ["manual", "input", "focus"],
      control: {
        type: "radio",
      },
    },
  },

  parameters: {
    controls: { expanded: true },
  },
};

export default meta;

const Template: StoryFn<ButtonProps> = (args) => (
  <ThemeWrapper>
    <Button {...args} />
  </ThemeWrapper>
);

export const Default = Template.bind({});

const liCSS = css`
  display: flex;
  flex-direction: row;
  gap: 8px;
  align-items: center;
`;

export const Migration = () => {
  return (
    <>
      <ThemeWrapper>
        <ul
          css={css`
            display: flex;
            flex-direction: column;
            gap: 4px;
          `}
        >
          <li css={liCSS}>
            <Button key="new" icon={<Icon svg={<Icons.PlusCircleOutline />} />}>
              Button
            </Button>
            <LegacyButton
              variant="default"
              key="old"
              icon={<Icon svg={<Icons.PlusCircleOutline />} />}
            >
              Legacy
            </LegacyButton>
            <Button key="new-s" size="S">
              Button
            </Button>
            <LegacyButton variant="default" key="old-s" size="compact">
              Legacy
            </LegacyButton>
          </li>
          <li css={liCSS}>
            <Button key="new" variant="primary">
              Button
            </Button>
            <LegacyButton variant="primary" key="old">
              Legacy
            </LegacyButton>
          </li>
          <li css={liCSS}>
            <Button key="new" variant="danger">
              Button
            </Button>
            <LegacyButton variant="danger" key="old">
              Legacy
            </LegacyButton>
          </li>
          <li css={liCSS}>
            <Button key="new" variant="success">
              Button
            </Button>
            <LegacyButton variant="success" key="old">
              Legacy
            </LegacyButton>
          </li>
        </ul>
      </ThemeWrapper>
    </>
  );
};
