import type { Meta, StoryFn, StoryObj } from "@storybook/react";
import { userEvent, within } from "storybook/test";

import { Flex, Input, Label, TextField, View } from "@phoenix/components";
import type { ComboBoxProps } from "@phoenix/components/core/combobox/ComboBox";
import {
  ComboBox,
  ComboBoxItem,
} from "@phoenix/components/core/combobox/ComboBox";

import { OptionGrid } from "../../utils/OptionGrid";

const meta: Meta = {
  title: "Design System/Forms/Combo Box",
  tags: ["updated", "unreviewed", "incomplete"],
  component: ComboBox,
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
    layout: "centered",
  },
};

export default meta;

const Template: StoryFn<ComboBoxProps<object>> = (args) => (
  <View width="300px">
    <ComboBox {...args}>
      <ComboBoxItem textValue="Chocolate" key={"chocolate"}>
        Chocolate
      </ComboBoxItem>
      <ComboBoxItem textValue="Mint" key={"mint"}>
        Mint
      </ComboBoxItem>
      <ComboBoxItem textValue="Strawberry" key={"strawberry"}>
        Strawberry
      </ComboBoxItem>
      <ComboBoxItem textValue="Vanilla" key={"vanilla"}>
        Vanilla
      </ComboBoxItem>
    </ComboBox>
  </View>
);

export const Default = {
  tags: ["!dev"],
  render: Template,

  args: {
    label: "Ice cream flavor",
  },
};

export const KeyboardNavigation = {
  tags: ["!dev"],
  render: () => (
    <View width="300px">
      <Flex direction="column" gap="size-100">
        <ComboBox label="Prompt" stopPropagation>
          <ComboBoxItem textValue="Customer support" key="customer-support">
            Customer support
          </ComboBoxItem>
          <ComboBoxItem textValue="Product summary" key="product-summary">
            Product summary
          </ComboBoxItem>
        </ComboBox>
        <TextField>
          <Label>Description</Label>
          <Input />
        </TextField>
      </Flex>
    </View>
  ),
};

const FLAVORS = ["Chocolate", "Mint", "Strawberry", "Vanilla"];

const STATES: { label: string; props: Partial<ComboBoxProps<object>> }[] = [
  { label: "empty", props: {} },
  { label: "populated", props: { defaultSelectedKey: "mint" } },
  {
    label: "read only",
    props: { isReadOnly: true, defaultSelectedKey: "mint" },
  },
  {
    label: "disabled",
    props: { isDisabled: true, defaultSelectedKey: "mint" },
  },
  {
    label: "error",
    props: { errorMessage: "Pick a flavor that is in stock" },
  },
];

const SIZES = (["S", "M", "L"] as const).map((size) => ({
  label: size,
  code: true,
  size,
}));

function FlavorComboBox(props: Partial<ComboBoxProps<object>>) {
  return (
    <ComboBox label="Ice cream flavor" width="200px" {...props}>
      {FLAVORS.map((flavor) => (
        <ComboBoxItem
          key={flavor}
          // React Aria reads an item's id, not React's key, so a
          // selection can only be set on items that have one.
          id={flavor.toLowerCase()}
          textValue={flavor}
        >
          {flavor}
        </ComboBoxItem>
      ))}
    </ComboBox>
  );
}

export const StatesAndSizes: StoryFn = () => (
  <OptionGrid
    rows={STATES}
    columns={SIZES}
    cellWidth={"200px"}
    alignRows="start"
    renderCell={(state, size) => (
      <FlavorComboBox size={size?.size} {...state.props} />
    )}
  />
);
StatesAndSizes.parameters = { themeLayout: "column" };
StatesAndSizes.tags = ["!dev"];

const SLOTS: { label: string; props: Partial<ComboBoxProps<object>> }[] = [
  { label: "Bare", props: {} },
  { label: "Description", props: { description: "Shown on the menu page" } },
];

export const StatesAndSlots: StoryFn = () => (
  <OptionGrid
    rows={STATES}
    columns={SLOTS}
    cellWidth={"200px"}
    alignRows="start"
    renderCell={(state, slot) => (
      <FlavorComboBox {...slot?.props} {...state.props} />
    )}
  />
);
StatesAndSlots.storyName = "States and Slots";
StatesAndSlots.parameters = { themeLayout: "column" };
StatesAndSlots.tags = ["!dev"];

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: StoryObj<ComboBoxProps<object>> = {
  tags: ["!dev", "!autodocs"],
  args: {
    label: "Ice cream flavor",
  },
  render: (args) => (
    <View width="240px" alignSelf="start">
      <ComboBox {...args}>
        <ComboBoxItem textValue="Chocolate" key={"chocolate"}>
          Chocolate
        </ComboBoxItem>
        <ComboBoxItem textValue="Mint" key={"mint"}>
          Mint
        </ComboBoxItem>
        <ComboBoxItem textValue="Strawberry" key={"strawberry"}>
          Strawberry
        </ComboBoxItem>
      </ComboBox>
    </View>
  ),
  // There is no open prop; press the field's button, as a pointer would.
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button"));
  },
};
