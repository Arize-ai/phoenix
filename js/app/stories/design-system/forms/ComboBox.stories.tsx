import type { Meta, StoryFn, StoryObj } from "@storybook/react";
import { userEvent, within } from "storybook/test";

import { Flex, Input, Label, TextField, View } from "@phoenix/components";
import type { ComboBoxProps } from "@phoenix/components/core/combobox/ComboBox";
import {
  ComboBox,
  ComboBoxItem,
} from "@phoenix/components/core/combobox/ComboBox";

import { LONG_PROMPT_NAMES } from "../../constants/menuFixtures";
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

const [SHORT_PROMPT, HYPHENATED_PROMPT, SENTENCE_PROMPT] = LONG_PROMPT_NAMES;

const ITEM_LENGTHS = [
  SHORT_PROMPT,
  { id: "regular", name: "customer-support-triage" },
  HYPHENATED_PROMPT,
  {
    id: "underscored",
    name: "customer_support_escalation_classifier_for_billing_disputes_and_refund_requests_v12",
  },
  {
    id: "path",
    name: "metadata.retrieval.documents[0].document.metadata.source_document_identifier",
  },
  SENTENCE_PROMPT,
];

/**
 * Items wrap within the popover, which is as wide as the field. A line breaks
 * at a space or hyphen, or after an identifier's `_`, `.`, `/` or `:`, and
 * between characters only when a segment is longer than a line.
 */
export const ContentLength: StoryObj<ComboBoxProps<object>> = {
  tags: ["!dev"],
  render: () => (
    <View width="300px">
      <ComboBox label="Prompt">
        {ITEM_LENGTHS.map((prompt) => (
          <ComboBoxItem key={prompt.id} id={prompt.id} textValue={prompt.name}>
            {prompt.name}
          </ComboBoxItem>
        ))}
      </ComboBox>
    </View>
  ),
  // There is no open prop; press the field's button, as a pointer would. Only
  // one list can be open, so in Both mode the first theme's opens.
  play: async ({ canvasElement }) => {
    const [button] = within(canvasElement).getAllByRole("button");
    await userEvent.click(button);
  },
};

const VALUE_LENGTHS = [
  { label: "Regular", promptId: "regular" },
  { label: "Long identifier", promptId: "underscored" },
  { label: "Long path", promptId: "path" },
  { label: "Long sentence", promptId: "sentence" },
];

export const ValueLength: StoryFn = () => (
  <OptionGrid
    rows={VALUE_LENGTHS}
    cellWidth="240px"
    renderCell={(row) => (
      <ComboBox
        aria-label="Prompt"
        width="240px"
        defaultSelectedKey={row.promptId}
      >
        {ITEM_LENGTHS.map((prompt) => (
          <ComboBoxItem key={prompt.id} id={prompt.id} textValue={prompt.name}>
            {prompt.name}
          </ComboBoxItem>
        ))}
      </ComboBox>
    )}
  />
);
ValueLength.parameters = { themeLayout: "column" };
ValueLength.tags = ["!dev"];

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
