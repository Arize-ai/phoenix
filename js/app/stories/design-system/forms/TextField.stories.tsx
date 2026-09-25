import type { Meta, StoryFn, StoryObj } from "@storybook/react";

import type { TextFieldProps } from "@phoenix/components";
import { FieldError, Input, Label, Text, TextField } from "@phoenix/components";
import {
  FieldDangerIcon,
  FieldSuccessIcon,
} from "@phoenix/components/core/field";

import { OptionGrid } from "../../utils/OptionGrid";

const meta: Meta = {
  title: "Design System/Forms/Text Field",
  tags: ["updated", "unreviewed", "incomplete"],
  component: TextField,
  subcomponents: { Input },
  parameters: {
    controls: { expanded: true },
    design: {
      type: "figma",
      url: "https://www.figma.com/design/rMddnj6eV2TcQqNkejJ9qX/Core?node-id=32-95",
    },
  },
};

export default meta;

const Template: StoryFn<TextFieldProps> = (args) => (
  <TextField {...args}>
    <Label>Name</Label>
    <Input />
    <Text slot="description">A name to identify the key</Text>
  </TextField>
);

export const Default = {
  tags: ["!dev"],
  render: Template,
};

const STATES: {
  label: string;
  props: Partial<TextFieldProps>;
  placeholder?: string;
  error?: string;
}[] = [
  { label: "empty", props: {} },
  { label: "placeholder", props: {}, placeholder: "e.g. correctness" },
  { label: "populated", props: { defaultValue: "correctness" } },
  { label: "required", props: { isRequired: true } },
  { label: "read only", props: { isReadOnly: true, value: "correctness" } },
  {
    label: "disabled",
    props: { isDisabled: true, defaultValue: "correctness" },
  },
  {
    label: "error",
    props: { isInvalid: true, defaultValue: "correctness" },
    error: "An evaluator with this name already exists",
  },
];

const SIZES = (["S", "M", "L"] as const).map((size) => ({
  label: size,
  code: true,
  size,
}));

export const StatesAndSizes: StoryFn = () => (
  <OptionGrid
    rows={STATES}
    columns={SIZES}
    cellWidth="220px"
    alignRows="start"
    renderCell={(state, size) => (
      <TextField size={size?.size} {...state.props}>
        <Label>Name</Label>
        <Input placeholder={state.placeholder} />
        {state.error ? <FieldError>{state.error}</FieldError> : null}
      </TextField>
    )}
  />
);
StatesAndSizes.parameters = { themeLayout: "column" };
StatesAndSizes.tags = ["!dev"];

const SLOTS: {
  label: string;
  description?: boolean;
  icon?: "success" | "danger";
}[] = [
  { label: "Bare" },
  { label: "Description", description: true },
  { label: "Success icon", icon: "success" },
  { label: "Danger icon", icon: "danger" },
];

function SlotField({
  slot,
  hasLabel = true,
  state,
}: {
  slot: (typeof SLOTS)[number];
  hasLabel?: boolean;
  state?: (typeof STATES)[number];
}) {
  const fieldLabel = state ? "Name" : "Pattern";
  return (
    <TextField
      defaultValue={state ? undefined : "^gpt-4$"}
      aria-label={hasLabel ? undefined : fieldLabel}
      {...state?.props}
    >
      {hasLabel ? <Label>{fieldLabel}</Label> : null}
      <Input placeholder={state?.placeholder} />
      {slot.description ? (
        <Text slot="description">
          {state ? "A name to identify the evaluator" : "A regular expression"}
        </Text>
      ) : null}
      {slot.icon === "success" ? <FieldSuccessIcon /> : null}
      {slot.icon === "danger" ? <FieldDangerIcon /> : null}
      {state?.error ? <FieldError>{state.error}</FieldError> : null}
    </TextField>
  );
}

const LABELING = [
  { label: "No label", hasLabel: false },
  { label: "Label", hasLabel: true },
];

export const Slots: StoryFn = () => (
  <OptionGrid
    rows={SLOTS}
    columns={LABELING}
    cellWidth="240px"
    alignRows="start"
    renderCell={(slot, labeling) => (
      <SlotField slot={slot} hasLabel={labeling?.hasLabel} />
    )}
  />
);
Slots.parameters = { themeLayout: "column" };
Slots.tags = ["!dev"];

export const StatesAndSlots: StoryFn = () => (
  <OptionGrid
    rows={STATES}
    columns={SLOTS}
    cellWidth="220px"
    alignRows="start"
    renderCell={(state, slot) =>
      slot ? <SlotField slot={slot} state={state} /> : null
    }
  />
);
StatesAndSlots.storyName = "States and Slots";
StatesAndSlots.parameters = { themeLayout: "column" };
StatesAndSlots.tags = ["!dev"];

const LENGTHS = [
  { label: "empty", value: "" },
  { label: "one character", value: "a" },
  { label: "regular", value: "Production key" },
  {
    label: "long",
    value:
      "Production ingestion key for the retrieval-augmented support assistant",
  },
];

export const ContentLength: StoryFn = () => (
  <OptionGrid
    rows={LENGTHS}
    cellWidth="240px"
    renderCell={(length) => (
      <TextField defaultValue={length.value}>
        <Label>Name</Label>
        <Input />
      </TextField>
    )}
  />
);
ContentLength.parameters = { themeLayout: "column" };
ContentLength.tags = ["!dev"];

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: StoryObj<TextFieldProps> = {
  tags: ["!dev", "!autodocs"],
  render: () => (
    <TextField>
      <Label>Base URL</Label>
      <Input placeholder="https://api.openai.com/v1" />
      <Text slot="description">
        Custom base URL for OpenAI-compatible endpoints
      </Text>
    </TextField>
  ),
};
