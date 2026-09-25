import type { Meta, StoryFn, StoryObj } from "@storybook/react";

import type { NumberFieldProps } from "@phoenix/components";
import {
  FieldError,
  Input,
  Label,
  NumberField,
  Text,
} from "@phoenix/components";

import { OptionGrid } from "../../utils/OptionGrid";

const meta: Meta = {
  title: "Design System/Forms/Number Field",
  tags: ["updated", "unreviewed", "incomplete"],
  component: NumberField,

  parameters: {
    controls: { expanded: true },
  },
};

export default meta;

const Template: StoryFn<NumberFieldProps> = (args) => (
  <NumberField {...args}>
    <Label>Label</Label>
    <Input type="text" />
    <Text slot="description">Description</Text>
  </NumberField>
);

export const Default = {
  tags: ["!dev"],
  render: Template,
};

const STATES: {
  label: string;
  props: Partial<NumberFieldProps>;
  error?: string;
}[] = [
  { label: "empty", props: {} },
  { label: "populated", props: { defaultValue: 42 } },
  { label: "read only", props: { isReadOnly: true, value: 42 } },
  { label: "disabled", props: { isDisabled: true, defaultValue: 42 } },
  {
    label: "error",
    props: { isInvalid: true, defaultValue: -1 },
    error: "Must be a positive number",
  },
];

const SIZES = (["S", "M", "L"] as const).map((size) => ({
  label: size,
  code: true,
  size,
}));

function MaxTokensField({
  state,
  description,
  ...props
}: Partial<NumberFieldProps> & {
  state: (typeof STATES)[number];
  description?: string;
}) {
  return (
    <NumberField {...props} {...state.props}>
      <Label>Max tokens</Label>
      <Input type="text" />
      {description ? <Text slot="description">{description}</Text> : null}
      {state.error ? <FieldError>{state.error}</FieldError> : null}
    </NumberField>
  );
}

export const StatesAndSizes: StoryFn = () => (
  <OptionGrid
    rows={STATES}
    columns={SIZES}
    cellWidth="200px"
    alignRows="start"
    renderCell={(state, size) => (
      <MaxTokensField state={state} size={size?.size} />
    )}
  />
);
StatesAndSizes.parameters = { themeLayout: "column" };
StatesAndSizes.tags = ["!dev"];

const SLOTS: { label: string; description?: string }[] = [
  { label: "Bare" },
  { label: "Description", description: "Field description" },
];

export const StatesAndSlots: StoryFn = () => (
  <OptionGrid
    rows={STATES}
    columns={SLOTS}
    cellWidth="200px"
    alignRows="start"
    renderCell={(state, slot) => (
      <MaxTokensField state={state} description={slot?.description} />
    )}
  />
);
StatesAndSlots.storyName = "States and Slots";
StatesAndSlots.parameters = { themeLayout: "column" };
StatesAndSlots.tags = ["!dev"];

const FORMATS: {
  label: string;
  fieldLabel: string;
  defaultValue: number;
  formatOptions: Intl.NumberFormatOptions;
}[] = [
  {
    label: "currency",
    fieldLabel: "Cost per 1M tokens",
    defaultValue: 2.5,
    formatOptions: {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    },
  },
  {
    label: "percent",
    fieldLabel: "Sample rate",
    defaultValue: 0.25,
    formatOptions: { style: "percent" },
  },
  {
    label: "unit",
    fieldLabel: "Timeout",
    defaultValue: 30,
    formatOptions: { style: "unit", unit: "second", unitDisplay: "long" },
  },
];

/**
 * Number fields can format their value for display, such as a currency, a
 * percentage, or a unit. Pass `formatOptions`, which takes the same options
 * as `Intl.NumberFormat`. The field shows the formatted text, but its value
 * stays a plain number: typing `$2.50` gives `2.5`, and `25%` gives `0.25`.
 */
export const Formatting: StoryFn = () => (
  <OptionGrid
    rows={FORMATS}
    cellWidth="240px"
    renderCell={(format) => (
      <NumberField
        defaultValue={format.defaultValue}
        formatOptions={format.formatOptions}
      >
        <Label>{format.fieldLabel}</Label>
        <Input />
      </NumberField>
    )}
  />
);
Formatting.tags = ["!dev"];

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: StoryObj<NumberFieldProps> = {
  tags: ["!dev", "!autodocs"],
  render: () => (
    <NumberField
      defaultValue={2.5}
      formatOptions={{
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
      }}
    >
      <Label>Cost per 1M tokens</Label>
      <Input />
    </NumberField>
  ),
};
